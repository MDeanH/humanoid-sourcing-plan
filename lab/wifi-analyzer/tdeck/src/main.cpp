// LilyGO T-Deck Wi-Fi analyzer for the robot lab.
//
// Listens only on Wi-Fi: passive scans (no probe requests), never joins a network, captures no frames. Logs
// BSSID, channel, signal and name, in the shared format (lab/wifi-analyzer/README.md), to the SD card and to USB
// serial. The one thing it transmits is the group link: a 1-per-second non-connectable BLE advert with its scan
// summary (common/wifilogic/src/groupframe.h). It listens for the same adverts from the LoRa32 and the watch.
//
// Screens (trackball left/right): CHANNELS, NETWORKS, TRACK, GROUP.
//   NETWORKS: trackball up/down picks a network, click tracks it.
//   TRACK: scans only that network's channel; click (or leaving the screen) stops tracking.
// Keys: r = SD logging on/off (/wifi/scanNNN.tsv), p = pause. Logging starts by itself at power-on when an SD
// card is in, so the T-Deck logs with no computer attached. The same letters work over USB serial, plus
// w/a/s/d = trackball up/left/down/right, Enter or space = click, S = screenshot dump (tools/shot.py),
// L = print the newest log file's size and last lines (to check the card from a computer).
//
// Pins from Xinyuan-LilyGO/T-Deck @1dddf6e, examples/UnitTest/utilities.h (all matched the brief).
#include <Arduino.h>
#include <BLEAdvertising.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <SD.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_bt.h>
#include <esp_mac.h>
#include <esp_wifi.h>

#include "groupframe.h"
#include "wifilogic.h"

#define FW_VERSION "1.0.0"

// ---- pins ----------------------------------------------------------------------------------------------------
static const int PIN_POWER_ON = 10;   // peripheral power, must be HIGH
static const int PIN_I2C_SDA = 18, PIN_I2C_SCL = 8;
static const uint8_t KB_ADDR = 0x55;
static const int PIN_TB_UP = 3, PIN_TB_DOWN = 15, PIN_TB_LEFT = 1, PIN_TB_RIGHT = 2, PIN_TB_CLICK = 0;
static const int PIN_SPI_SCK = 40, PIN_SPI_MOSI = 41, PIN_SPI_MISO = 38;
static const int PIN_TFT_CS = 12, PIN_TFT_BL = 42;   // DC 11 is set in TFT_eSPI's Setup210
static const int PIN_SD_CS = 39, PIN_LORA_CS = 9;     // LoRa is never used; its CS is held high

// ---- timing --------------------------------------------------------------------------------------------------
static const uint32_t SCAN_EVERY_MS = 3000;     // full scan cadence (a passive pass over 13 channels takes ~2 s)
static const uint32_t TRACK_EVERY_MS = 500;     // one-channel scans while tracking
static const uint32_t FULL_DWELL_MS = 200;      // per channel; beacons come every ~102 ms
static const uint32_t TRACK_DWELL_MS = 300;
static const uint32_t PEER_STALE_MS = 15000;    // a group member not heard for this long is shown as stale

// ---- state ---------------------------------------------------------------------------------------------------
enum Screen { SCR_CHANNELS, SCR_NETWORKS, SCR_TRACK, SCR_GROUP, SCR_COUNT };
static const char *SCREEN_NAMES[SCR_COUNT] = {"CHANNELS", "NETWORKS", "TRACK", "GROUP"};
static int screen = SCR_CHANNELS;

static const int MAX_NETS = 64;
static wl::Net nets[MAX_NETS];
static int netCount = 0;
static int heardTotal = 0;            // networks in the last full scan, before the MAX_NETS cap
static wl::ChannelSummary chs;
static uint32_t scanNo = 0, lastScanDoneMs = 0, nextScanMs = 0, scanStartMs = 0;
static bool scanning = false, paused = false, scanTracking = false;
static int scanFailures = 0;

static int sel = 0, listTop = 0;      // NETWORKS selection
static bool tracking = false;
static uint8_t trackBssid[6];
static uint8_t trackCh = 0;
static char trackSsid[33] = "";
static wl::History<150> hist;
static bool trackHeard = false;       // heard in the last tracking scan
static uint32_t trackMisses = 0;

static bool sdOk = false, logging = false;
static File logFile;
static char logName[24] = "";
static uint32_t logLines = 0;

static TFT_eSPI tft;
static TFT_eSprite spr(&tft);
static bool kbOk = false;

// trackball pulses, counted in interrupts
static volatile int tbUp = 0, tbDown = 0, tbLeft = 0, tbRight = 0;
static void IRAM_ATTR isrUp() { tbUp++; }
static void IRAM_ATTR isrDown() { tbDown++; }
static void IRAM_ATTR isrLeft() { tbLeft++; }
static void IRAM_ATTR isrRight() { tbRight++; }

// group link
static BLEAdvertising *adv = nullptr;
static BLEScan *bscan = nullptr;
static gf::Frame me;
static gf::PeerTable<8> peers;
static uint8_t peerPrintedSeq[8];
static bool peerPrinted[8];
static portMUX_TYPE peerMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool bleScanDone = true;

static bool dirty = true;             // redraw needed

// ---- serial: data lines raw, everything else after "# " -----------------------------------------------------
static void note(const char *fmt, ...) {
  char buf[160];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(buf, sizeof buf, fmt, ap);
  va_end(ap);
  Serial.print("# ");
  Serial.println(buf);
}

static void stamp(char *out, size_t n) { wl::uptimeStamp(millis(), out, n); }

// ---- SD logging ----------------------------------------------------------------------------------------------
static bool openNextLog() {
  if (!sdOk) return false;
  if (!SD.exists("/wifi")) SD.mkdir("/wifi");
  for (int i = 0; i < 1000; i++) {
    snprintf(logName, sizeof logName, "/wifi/scan%03d.tsv", i);
    if (!SD.exists(logName)) {
      logFile = SD.open(logName, FILE_WRITE);
      logLines = 0;
      return (bool)logFile;
    }
  }
  return false;
}

static void setLogging(bool on) {
  if (on == logging) return;
  if (on) {
    if (!sdOk) { note("no SD card: logging stays off"); return; }
    if (!openNextLog()) { note("could not open a log file on the SD card"); return; }
    logging = true;
    note("logging to %s", logName);
  } else {
    logFile.close();
    logging = false;
    note("logging stopped: %lu lines in %s", (unsigned long)logLines, logName);
  }
  dirty = true;
}

// ---- Wi-Fi: passive scans only ------------------------------------------------------------------------------
static void wifiListenOnly() {
  WiFi.persistent(false);              // never write credentials
  WiFi.setAutoReconnect(false);
  WiFi.mode(WIFI_STA);                 // station mode is needed to scan; WiFi.begin() is never called
  esp_wifi_set_storage(WIFI_STORAGE_RAM);
  WiFi.disconnect(false, false);
}

static void bleListenPause();

static void startScan() {
  bleListenPause();   // give the passive Wi-Fi scan the whole radio; BLE listening resumes between scans
  scanTracking = tracking;
  // async, show hidden, PASSIVE (listen for beacons, send no probe requests), dwell, channel (0 = all)
  int16_t r = tracking ? WiFi.scanNetworks(true, true, true, TRACK_DWELL_MS, trackCh)
                       : WiFi.scanNetworks(true, true, true, FULL_DWELL_MS, 0);
  scanning = (r == WIFI_SCAN_RUNNING);
  scanStartMs = millis();
  if (!scanning) {
    scanFailures++;
    nextScanMs = millis() + 1000;
  }
}

static void updateBeacon();

static void finishScan(int n) {
  char t[16];
  stamp(t, sizeof t);
  scanNo++;
  lastScanDoneMs = millis();
  bool found = false;
  if (!scanTracking) { netCount = 0; chs.clear(); heardTotal = n; }
  for (int i = 0; i < n; i++) {
    const uint8_t *b = WiFi.BSSID(i);
    int ch = WiFi.channel(i);
    int rssi = WiFi.RSSI(i);
    String ssid = WiFi.SSID(i);
    char chName[8], line[96];
    if (!b || !wl::channelName(2, ch, chName, sizeof chName)) continue;
    if (wl::scanLine(line, sizeof line, t, b, chName, rssi, ssid.c_str()) > 0) {
      Serial.println(line);
      if (logging) { logFile.println(line); logLines++; }
    }
    if (scanTracking) {
      if (memcmp(b, trackBssid, 6) == 0) { hist.push(rssi); found = true; }
      continue;
    }
    chs.add(ch, rssi);
    if (netCount < MAX_NETS) {
      wl::Net &x = nets[netCount++];
      memcpy(x.bssid, b, 6);
      x.rssi = (int8_t)rssi;
      x.ch = (uint8_t)ch;
      wl::cleanName(ssid.c_str(), x.ssid, sizeof x.ssid);
    }
  }
  WiFi.scanDelete();
  if (logging) logFile.flush();
  note("scan %lu: %d networks%s in %lu ms", (unsigned long)scanNo, n, scanTracking ? " on the tracked channel" : "",
       (unsigned long)(lastScanDoneMs - scanStartMs));
  if (scanTracking) {
    trackHeard = found;
    if (!found) trackMisses++;
  } else {
    wl::sortBySignal(nets, netCount);
    if (sel >= netCount) sel = netCount ? netCount - 1 : 0;
  }
  scanning = false;
  nextScanMs = millis() + (tracking ? TRACK_EVERY_MS : SCAN_EVERY_MS);
  updateBeacon();
  dirty = true;
}

static void startTracking(const wl::Net &n) {
  memcpy(trackBssid, n.bssid, 6);
  trackCh = n.ch;
  strncpy(trackSsid, n.ssid, sizeof trackSsid);
  trackSsid[sizeof trackSsid - 1] = 0;
  hist.clear();
  hist.push(n.rssi);
  trackHeard = true;
  trackMisses = 0;
  tracking = true;
  char b[18];
  wl::formatBssid(trackBssid, b);
  note("tracking %s on 2g%d (%s)", b, trackCh, trackSsid);
  nextScanMs = millis();   // the scan running now is a full one; the next is channel-only
}

static void stopTracking() {
  if (!tracking) return;
  tracking = false;
  note("tracking stopped");
  nextScanMs = millis();
}

// ---- group link (BLE) -----------------------------------------------------------------------------------------
class GroupListener : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice d) override {
    gf::Frame f;
    if (!gf::decodeAdv(d.getPayload(), d.getPayloadLength(), &f)) return;
    if (f.kind == me.kind && f.id == me.id) return;
    portENTER_CRITICAL(&peerMux);
    peers.update(f, (int8_t)d.getRSSI(), millis());
    portEXIT_CRITICAL(&peerMux);
  }
};
static GroupListener groupListener;

static void bleScanComplete(BLEScanResults) { bleScanDone = true; }

static void updateBeacon() {
  if (!adv) return;
  me.seq++;
  me.flags = (scanNo ? gf::F_SCAN : 0) | (paused ? gf::F_PAUSED : 0) | (logging ? gf::F_LOGGING : 0) |
             (tracking ? gf::F_TRACKING : 0) | (spr.created() ? gf::F_HW_DISPLAY : 0) | (kbOk ? gf::F_HW_INPUT : 0);
  me.nets = gf::sat8(heardTotal);
  memset(me.chcount, 0, sizeof me.chcount);
  for (int c = 1; c <= 13; c++) me.chcount[c] = chs.count[c];
  me.bestCh = netCount ? nets[0].ch : 0;
  me.bestDbm = netCount ? nets[0].rssi : 0;
  me.trackCh = tracking ? trackCh : 0;
  me.trackDbm = (tracking && hist.count) ? (int8_t)hist.last() : 0;
  me.ageS = 0;
  uint8_t buf[gf::kAdvLen];
  size_t n = gf::encodeAdv(me, buf, sizeof buf);
  BLEAdvertisementData d;
  d.addData(std::string((const char *)buf, n));
  adv->setAdvertisementData(d);
}

static void groupBegin() {
  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_BT);
  me.kind = gf::KIND_TDECK;
  me.id = (uint16_t)(mac[4] | (mac[5] << 8));
  BLEDevice::init("");
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_N0);   // 0 dBm
  adv = BLEDevice::getAdvertising();
  adv->setAdvertisementType(ADV_TYPE_NONCONN_IND);   // nobody can connect
  adv->setScanResponse(false);
  adv->setMinInterval(1600);   // 1 s
  adv->setMaxInterval(1600);
  updateBeacon();
  adv->start();
  bscan = BLEDevice::getScan();
  bscan->setAdvertisedDeviceCallbacks(&groupListener, true);   // every advert, so updates arrive
  bscan->setActiveScan(false);                                 // passive: no scan requests
  bscan->setInterval(100);                                     // ms (the library converts)
  bscan->setWindow(100);                                       // listen all the time between Wi-Fi scans
  note("group link: T-Deck id %04x, advert 1/s at 0 dBm, passive BLE listen", me.id);
}

static void bleListenPause() {
  if (!bscan || bleScanDone) return;
  bscan->stop();          // stop() does not call the completion callback
  bleScanDone = true;
}

// The library keeps every advertiser it hears; scan in 5 s windows and clear in between. Not during Wi-Fi scans.
static void groupPoll() {
  if (!bscan || !bleScanDone || scanning) return;
  bscan->clearResults();
  bleScanDone = false;
  if (!bscan->start(5, bleScanComplete, false)) bleScanDone = true;
}

static void printPeerUpdates() {
  for (int i = 0; i < 8; i++) {
    gf::Peer p;
    portENTER_CRITICAL(&peerMux);
    p = peers.p[i];
    portEXIT_CRITICAL(&peerMux);
    if (!p.used || (peerPrinted[i] && peerPrintedSeq[i] == p.f.seq)) continue;
    peerPrinted[i] = true;
    peerPrintedSeq[i] = p.f.seq;
    note("group %s %04x seq=%u flags=%u nets=%u pax=%u best=2g%u/%d track=2g%u/%d advert_rssi=%d",
         gf::kindName(p.f.kind), p.f.id, p.f.seq, p.f.flags, p.f.nets, p.f.pax, p.f.bestCh, p.f.bestDbm,
         p.f.trackCh, p.f.trackDbm, p.rssi);
    dirty = true;
  }
}

// ---- drawing ------------------------------------------------------------------------------------------------
static const uint16_t C_BG = TFT_BLACK, C_FG = TFT_WHITE, C_DIM = 0x8410, C_LINE = 0x31A6;
static const uint16_t C_GOOD = 0x07E0, C_FAIR = 0xFFE0, C_POOR = 0xF800, C_ACCENT = 0x05FF;

static uint16_t gradeColor(int dbm) {
  wl::Grade g = wl::grade(dbm);
  return g == wl::GOOD ? C_GOOD : g == wl::FAIR ? C_FAIR : C_POOR;
}

static void header() {
  spr.fillRect(0, 0, 320, 20, 0x10A2);
  spr.setTextFont(2);
  spr.setTextColor(C_FG, 0x10A2);
  spr.setTextDatum(TL_DATUM);
  char left[40];
  snprintf(left, sizeof left, "< %s >", SCREEN_NAMES[screen]);
  spr.drawString(left, 4, 2);
  char right[48];
  snprintf(right, sizeof right, "%s%s%s #%lu", paused ? "PAUSED " : "", logging ? "REC " : "",
           tracking ? "TRK" : "ALL", (unsigned long)scanNo);
  spr.setTextDatum(TR_DATUM);
  spr.setTextColor(logging ? C_POOR : C_FG, 0x10A2);
  spr.drawString(right, 316, 2);
  spr.setTextDatum(TL_DATUM);
}

static void footer(const char *text) {
  spr.setTextFont(2);
  spr.setTextColor(C_DIM, C_BG);
  spr.setTextDatum(BL_DATUM);
  spr.drawString(text, 4, 239);
  spr.setTextDatum(TL_DATUM);
}

static void drawChannels() {
  int maxc = 4;
  for (int c = 1; c <= 13; c++) maxc = max(maxc, (int)chs.count[c]);
  const int x0 = 8, w = 23, top = 40, base = 196;
  for (int c = 1; c <= 13; c++) {
    int x = x0 + (c - 1) * w;
    bool main = (c == 1 || c == 6 || c == 11);
    if (main) spr.fillRect(x, top - 14, w - 2, base - top + 34, 0x0841);   // mark the non-overlapping channels
    int h = chs.count[c] * (base - top) / maxc;
    if (chs.count[c]) spr.fillRect(x + 3, base - h, w - 8, h, gradeColor(chs.strongest[c]));
    spr.setTextFont(2);
    spr.setTextDatum(BC_DATUM);
    spr.setTextColor(C_FG);
    if (chs.count[c]) spr.drawNumber(chs.count[c], x + w / 2 - 1, base - h - 1);
    spr.setTextDatum(TC_DATUM);
    spr.setTextColor(main ? C_ACCENT : C_DIM);
    spr.drawNumber(c, x + w / 2 - 1, base + 3);
  }
  spr.drawFastHLine(x0, base, 13 * w, C_LINE);
  spr.setTextDatum(TL_DATUM);
  char f[64];
  int q = chs.quietest1611();
  if (netCount)
    snprintf(f, sizeof f, "%d nets   quietest of 1/6/11: %d   top: ch%d %d", heardTotal, q, nets[0].ch, nets[0].rssi);
  else
    snprintf(f, sizeof f, scanNo ? "no networks heard" : "first passive scan...");
  footer(f);
}

static void drawNetworks() {
  const int rowH = 19, top = 24, rows = 10;
  if (sel < listTop) listTop = sel;
  if (sel >= listTop + rows) listTop = sel - rows + 1;
  spr.setTextFont(2);
  for (int r = 0; r < rows && listTop + r < netCount; r++) {
    int i = listTop + r, y = top + r * rowH;
    const wl::Net &n = nets[i];
    bool on = (i == sel);
    if (on) spr.fillRect(0, y - 1, 320, rowH, 0x2945);
    uint16_t bg = on ? 0x2945 : C_BG;
    spr.setTextColor(gradeColor(n.rssi), bg);
    spr.drawNumber(n.rssi, 4, y);
    spr.setTextColor(C_DIM, bg);
    char ch[6];
    snprintf(ch, sizeof ch, "%u", n.ch);
    spr.drawString(ch, 38, y);
    spr.setTextColor(C_FG, bg);
    char name[24];
    snprintf(name, sizeof name, "%.21s", n.ssid[0] ? n.ssid : "(hidden)");
    spr.drawString(name, 62, y);
    char b[18];
    wl::formatBssid(n.bssid, b);
    spr.setTextColor(C_DIM, bg);
    spr.setTextDatum(TR_DATUM);
    spr.drawString(b + 9, 316, y);   // last three bytes
    spr.setTextDatum(TL_DATUM);
  }
  char f[48];
  snprintf(f, sizeof f, netCount ? "%d of %d  click: track" : "no networks yet", netCount ? sel + 1 : 0, netCount);
  footer(f);
}

static void drawTrack() {
  spr.setTextFont(2);
  spr.setTextColor(C_FG);
  if (!tracking) {
    spr.drawString("Not tracking.", 8, 40);
    spr.drawString("Pick a network on NETWORKS, then click.", 8, 60);
    return;
  }
  char b[18];
  wl::formatBssid(trackBssid, b);
  char head[64];
  snprintf(head, sizeof head, "%.20s  2g%u", trackSsid[0] ? trackSsid : "(hidden)", trackCh);
  spr.drawString(head, 8, 24);
  spr.setTextColor(C_DIM);
  spr.drawString(b, 8, 40);
  int last = hist.last();
  uint16_t col = trackHeard ? gradeColor(last) : C_DIM;
  spr.setTextColor(col);
  char num[8];
  snprintf(num, sizeof num, "%d", -last);   // font 7 has no minus sign, so it is drawn as a bar
  int w = spr.textWidth(num, 7);
  spr.drawString(num, 150 - w, 58, 7);
  if (last < 0) spr.fillRect(150 - w - 30, 80, 22, 6, col);
  spr.setTextFont(4);
  spr.drawString("dBm", 156, 80);
  spr.setTextFont(2);
  spr.setTextColor(C_FG);
  char st[24];
  snprintf(st, sizeof st, "min %d", hist.mn); spr.drawString(st, 236, 56);
  snprintf(st, sizeof st, "avg %d", hist.avg()); spr.drawString(st, 236, 72);
  snprintf(st, sizeof st, "max %d", hist.mx); spr.drawString(st, 236, 88);
  // warning bar: below -75 poor, below -67 fair (Clearpath thresholds)
  const char *warn = !trackHeard ? "NOT HEARD IN LAST SCAN" : last < wl::kPoorDbm ? "POOR: below -75 dBm"
                   : last < wl::kGoodDbm ? "FAIR: below -67 dBm" : "GOOD: -67 dBm or better";
  uint16_t barCol = !trackHeard ? C_DIM : col;
  spr.fillRect(8, 110, 304, 18, barCol);
  spr.setTextColor(C_BG, barCol);
  spr.setTextDatum(TC_DATUM);
  spr.drawString(warn, 160, 111);
  spr.setTextDatum(TL_DATUM);
  // history graph, -30 (top) to -95 (bottom)
  const int gx = 8, gy = 132, gw = 304, gh = 86;
  spr.drawRect(gx, gy, gw, gh, C_LINE);
  auto yOf = [&](int dbm) { dbm = constrain(dbm, -95, -30); return gy + (int)((-30 - dbm) * (gh - 1) / 65); };
  for (int d : {wl::kGoodDbm, wl::kPoorDbm}) {
    int y = yOf(d);
    for (int x = gx + 1; x < gx + gw - 1; x += 6) spr.drawFastHLine(x, y, 3, d == wl::kGoodDbm ? C_GOOD : C_POOR);
  }
  for (int i = 1; i < hist.count; i++) {
    int x1 = gx + 1 + (i - 1) * (gw - 3) / 149, x2 = gx + 1 + i * (gw - 3) / 149;
    spr.drawLine(x1, yOf(hist.at(i - 1)), x2, yOf(hist.at(i)), gradeColor(hist.at(i)));
  }
  char f[64];
  snprintf(f, sizeof f, "%d samples, %lu missed  click: stop", hist.count, (unsigned long)trackMisses);
  footer(f);
}

static void drawGroup() {
  spr.setTextFont(2);
  int y = 24;
  uint32_t now = millis();
  int shown = 0;
  for (int i = 0; i < 8; i++) {
    gf::Peer p;
    portENTER_CRITICAL(&peerMux);
    p = peers.p[i];
    portEXIT_CRITICAL(&peerMux);
    if (!p.used) continue;
    shown++;
    uint32_t age = (now - p.heardMs) / 1000;
    bool stale = now - p.heardMs > PEER_STALE_MS;
    spr.setTextColor(stale ? C_DIM : C_ACCENT);
    char line[64];
    snprintf(line, sizeof line, "%s %04x  heard %lus ago  %d dBm", gf::kindName(p.f.kind), p.f.id, (unsigned long)age, p.rssi);
    spr.drawString(line, 6, y);
    spr.setTextColor(stale ? C_DIM : C_FG);
    if (p.f.flags & gf::F_PAX)
      snprintf(line, sizeof line, "  Wi-Fi devices counted: %u", p.f.pax);
    else if (p.f.flags & gf::F_SCAN)
      snprintf(line, sizeof line, "  %u nets, strongest 2g%u %d%s", p.f.nets, p.f.bestCh, p.f.bestDbm,
               (p.f.flags & gf::F_PAUSED) ? ", paused" : "");
    else
      snprintf(line, sizeof line, "  no data yet");
    spr.drawString(line, 6, y + 16);
    if (p.f.flags & gf::F_TRACKING) {
      snprintf(line, sizeof line, "  tracking 2g%u: %d dBm", p.f.trackCh, p.f.trackDbm);
      spr.setTextColor(gradeColor(p.f.trackDbm));
      spr.drawString(line, 170, y + 16);
    }
    y += 38;
    if (y > 200) break;
  }
  if (!shown) {
    spr.setTextColor(C_DIM);
    spr.drawString("Listening for the LoRa32 and the watch...", 6, 40);
  }
  char f[48];
  snprintf(f, sizeof f, "me: T-Deck %04x  seq %u", me.id, me.seq);
  footer(f);
}

static void render() {
  spr.fillSprite(C_BG);
  header();
  switch (screen) {
    case SCR_CHANNELS: drawChannels(); break;
    case SCR_NETWORKS: drawNetworks(); break;
    case SCR_TRACK: drawTrack(); break;
    case SCR_GROUP: drawGroup(); break;
  }
  spr.pushSprite(0, 0);
  dirty = false;
}

// Raw RGB565 dump of the frame buffer, for checking the layout from the Mac (tools/tdeck-shot.py).
static void screenshot() {
  render();
  Serial.setTxTimeoutMs(200);   // a dump must not drop bytes
  Serial.printf("# SHOT %d %d\n", spr.width(), spr.height());
  Serial.flush();
  const uint8_t *p = (const uint8_t *)spr.getPointer();
  size_t n = (size_t)spr.width() * spr.height() * 2;
  for (size_t i = 0; i < n; i += 512) Serial.write(p + i, min((size_t)512, n - i));
  Serial.println();
  Serial.println("# END");
  Serial.setTxTimeoutMs(0);
}

// Reads the newest /wifi/scanNNN.tsv back from the card: proves the lines really reached it.
static void dumpLog() {
  if (!sdOk) { note("no SD card"); return; }
  if (logging) logFile.flush();
  char newest[24] = "";
  if (logName[0]) strcpy(newest, logName);   // the file opened this session
  for (int i = 0; i < 1000 && !newest[0]; i++) {   // else the last of the run of existing files
    char n[24];
    snprintf(n, sizeof n, "/wifi/scan%03d.tsv", i);
    if (!SD.exists(n)) {
      if (i) snprintf(newest, sizeof newest, "/wifi/scan%03d.tsv", i - 1);
      break;
    }
  }
  if (!newest[0]) { note("no log files on the card"); return; }
  File f = SD.open(newest, FILE_READ);
  if (!f) { note("cannot open %s", newest); return; }
  size_t size = f.size(), lines = 0;
  size_t from = size > 600 ? size - 600 : 0;
  while (f.available()) if (f.read() == '\n') lines++;
  note("FILE %s %u bytes %u lines; last bytes:", newest, (unsigned)size, (unsigned)lines);
  f.seek(from);
  while (f.available()) Serial.write(f.read());
  f.close();
  note("END FILE");
}

// ---- input --------------------------------------------------------------------------------------------------
static void leaveScreen() { if (screen == SCR_TRACK) stopTracking(); }

static void action(char c) {
  switch (c) {
    case 'r': setLogging(!logging); break;
    case 'p': paused = !paused; note(paused ? "paused" : "resumed"); if (!paused) nextScanMs = millis(); break;
    case 'a': leaveScreen(); screen = (screen + SCR_COUNT - 1) % SCR_COUNT; break;
    case 'd': leaveScreen(); screen = (screen + 1) % SCR_COUNT; break;
    case 'w': if (screen == SCR_NETWORKS && sel > 0) sel--; break;
    case 's': if (screen == SCR_NETWORKS && sel + 1 < netCount) sel++; break;
    case '\n':
      if (screen == SCR_NETWORKS && netCount) { startTracking(nets[sel]); screen = SCR_TRACK; }
      else if (screen == SCR_TRACK && tracking) { stopTracking(); screen = SCR_NETWORKS; }
      break;
    default: return;
  }
  updateBeacon();
  dirty = true;
}

static void pollKeyboard() {
  if (!kbOk) return;
  if (Wire.requestFrom(KB_ADDR, (uint8_t)1) != 1) return;
  int k = Wire.read();
  if (k <= 0) return;   // 0x00 = no key, -1 = keyboard absent
  if (k == '\r') k = '\n';
  if (k == ' ') k = '\n';
  if (k == 'r' || k == 'p' || k == '\n') action((char)k);
}

static void pollSerial() {
  while (Serial.available()) {
    int c = Serial.read();
    if (c == 'S') { screenshot(); continue; }
    if (c == 'L') { dumpLog(); continue; }
    if (c == '\r' || c == ' ') c = '\n';
    action((char)c);
  }
}

// One roll of the ball gives a burst of pulses. Act once per burst, then ignore the rest briefly.
static void pollTrackball() {
  static uint32_t quietUntil = 0, clickSince = 0;
  static bool clickWas = false;
  uint32_t now = millis();
  noInterrupts();
  int u = tbUp, d = tbDown, l = tbLeft, r = tbRight;
  tbUp = tbDown = tbLeft = tbRight = 0;
  interrupts();
  if (now >= quietUntil) {
    int m = max(max(u, d), max(l, r));
    if (m >= 2) {   // a single stray pulse is noise
      if (m == l) action('a');
      else if (m == r) action('d');
      else if (m == u) action('w');
      else action('s');
      quietUntil = now + (m == l || m == r ? 400 : 120);
    }
  }
  bool down = digitalRead(PIN_TB_CLICK) == LOW;
  if (down && !clickWas) clickSince = now;
  if (!down && clickWas && now - clickSince > 30) action('\n');
  clickWas = down;
}

// ---- setup / loop --------------------------------------------------------------------------------------------
void setup() {
  pinMode(PIN_POWER_ON, OUTPUT);
  digitalWrite(PIN_POWER_ON, HIGH);
  // every chip select on the shared SPI bus high before anything talks on it
  for (int cs : {PIN_SD_CS, PIN_LORA_CS, PIN_TFT_CS}) { pinMode(cs, OUTPUT); digitalWrite(cs, HIGH); }
  pinMode(PIN_SPI_MISO, INPUT_PULLUP);
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);   // never stall the analyzer when nobody reads the USB port
  delay(500);                 // LilyGO: the keyboard needs time after power-on
  note("T-Deck Wi-Fi analyzer %s: passive scans, never joins a network", FW_VERSION);

  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);
  tft.init();
  tft.setRotation(1);   // landscape 320x240, as LilyGO's examples
  tft.fillScreen(TFT_BLACK);
  pinMode(PIN_TFT_BL, OUTPUT);
  digitalWrite(PIN_TFT_BL, HIGH);
  spr.setColorDepth(16);
  if (!spr.createSprite(320, 240)) note("no memory for the frame buffer");

  sdOk = SD.begin(PIN_SD_CS, SPI, 800000U);
  note(sdOk ? "SD card ready" : "no SD card");

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.beginTransmission(KB_ADDR);
  kbOk = Wire.endTransmission() == 0;
  note(kbOk ? "keyboard found at 0x55" : "keyboard not found at 0x55");

  for (int p : {PIN_TB_UP, PIN_TB_DOWN, PIN_TB_LEFT, PIN_TB_RIGHT, PIN_TB_CLICK}) pinMode(p, INPUT_PULLUP);
  attachInterrupt(PIN_TB_UP, isrUp, FALLING);
  attachInterrupt(PIN_TB_DOWN, isrDown, FALLING);
  attachInterrupt(PIN_TB_LEFT, isrLeft, FALLING);
  attachInterrupt(PIN_TB_RIGHT, isrRight, FALLING);

  wifiListenOnly();
  if (sdOk) setLogging(true);   // log from power-on; r stops and restarts (a new file each time)
  groupBegin();
  render();
  nextScanMs = millis();
}

void loop() {
  uint32_t now = millis();
  pollSerial();
  pollKeyboard();
  pollTrackball();
  groupPoll();
  printPeerUpdates();

  if (scanning) {
    // Core 2.0.11 reports WIFI_SCAN_FAILED once a scan runs past 20x the dwell time, even though the driver is
    // still scanning; with BLE sharing the radio a full passive pass takes longer than that. Keep waiting until
    // our own deadline: the result arrives (and scanComplete() returns the count) when the driver finishes.
    int n = WiFi.scanComplete();
    uint32_t limit = (scanTracking ? 1 : 13) * (scanTracking ? TRACK_DWELL_MS : FULL_DWELL_MS) * 4 + 3000;
    if (n >= 0) finishScan(n);
    else if (now - scanStartMs > limit) {
      esp_wifi_scan_stop();
      WiFi.scanDelete();
      scanning = false;
      scanFailures++;
      nextScanMs = now + 1000;
      note("scan gave no result within %lu ms", (unsigned long)limit);
    }
  } else if (!paused && (int32_t)(now - nextScanMs) >= 0) {
    startScan();
  }

  static uint32_t lastDraw = 0;
  if ((dirty && now - lastDraw > 100) || now - lastDraw > 1000) {   // also once a second, for the "heard ago" ages
    render();
    lastDraw = now;
  }
  delay(5);
}
