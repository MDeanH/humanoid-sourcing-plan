// Waveshare ESP32-S3-Touch-AMOLED-2.06 watch: Wi-Fi analyzer group display for the robot lab.
//
// What it does
//   * Listens for the group's BLE adverts (passive BLE scan, no scan requests) from the T-Deck and the LoRa32
//     Paxcounter, and shows them: GROUP (every member), TRACK (whatever network a T-Deck is tracking, big, with
//     the -67 / -75 dBm warnings) and CHANNELS (its own 2.4 GHz view).
//   * Runs its own passive Wi-Fi scan every 10 s (no probe requests, never joins a network) and puts the summary
//     in its own advert, so the T-Deck sees what the wrist hears.
//   * Tap anywhere, or press BOOT, for the next page.
// Over USB serial: "# " status lines and group updates; n = next page, S = raw screenshot (tools/shot.py).
// What it does not do: join any network, capture frames, write the PMU. It replaces Nori's watch firmware;
// reflash smart_nori_rover/esp32_nodes/nori_watch_control to get that back.
//
// Board pins and display init are copied from nori_watch_control (Waveshare pin_config.h and the vendor's
// 02_GFX_AsciiTable example), whose display init and touch ACK were verified on this watch (README there).
// What the glass shows and where a finger lands were never verified there, and are not verified here.
#include <Arduino.h>
#include <Arduino_GFX_Library.h>
#include <BLEAdvertising.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_bt.h>
#include <esp_mac.h>
#include <esp_wifi.h>

#include "groupframe.h"
#include "wifilogic.h"

#define FW_VERSION "1.0.0"

// ---- board -------------------------------------------------------------------------------------------------
static const int PIN_SDA = 15, PIN_SCL = 14;
static const int PIN_TP_RST = 9;
static const int PIN_BOOT = 0;
static const int LCD_SDIO0 = 4, LCD_SDIO1 = 5, LCD_SDIO2 = 6, LCD_SDIO3 = 7;
static const int LCD_SCLK = 11, LCD_CS = 12, LCD_RESET = 8;
static const int LCD_W = 410, LCD_H = 502;
static const uint8_t TP_ADDR = 0x38;

// Rounded-corner keep-out, from nori_watch_control (derived from Waveshare's drawing, unverified on glass).
static const int SAFE_X = 40, SAFE_Y = 40, SAFE_W = LCD_W - 2 * SAFE_X, SAFE_BOTTOM = LCD_H - SAFE_Y;

static Arduino_DataBus *bus = new Arduino_ESP32QSPI(LCD_CS, LCD_SCLK, LCD_SDIO0, LCD_SDIO1, LCD_SDIO2, LCD_SDIO3);
static Arduino_CO5300 *gfx = new Arduino_CO5300(bus, LCD_RESET, 0, LCD_W, LCD_H, 22, 0, 0, 0);
static Arduino_Canvas *ui = nullptr;
static bool displayOk = false, touchOk = false;

// ---- timing ------------------------------------------------------------------------------------------------
static const uint32_t SCAN_EVERY_MS = 10000;
static const uint32_t DWELL_MS = 200;
static const uint32_t PEER_STALE_MS = 15000;

// ---- state -------------------------------------------------------------------------------------------------
enum Page { PG_GROUP, PG_TRACK, PG_CHANNELS, PG_COUNT };
static const char *PAGE_NAMES[PG_COUNT] = {"GROUP", "TRACK", "CHANNELS"};
static int page = PG_GROUP;
static bool dirty = true;

static wl::ChannelSummary chs;
static int heard = 0, bestCh = 0, bestDbm = 0;
static uint32_t scanNo = 0, scanStartMs = 0, nextScanMs = 0, lastScanMs = 0;
static bool scanning = false;

static BLEAdvertising *adv = nullptr;
static BLEScan *bscan = nullptr;
static gf::Frame me;
static gf::PeerTable<8> peers;
static portMUX_TYPE peerMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool bleScanDone = true;

// what the TRACK page draws: the tracked signal of the freshest tracking peer, one sample per new advert
static wl::History<60> trackHist;
static uint16_t trackPeerId = 0;
static uint8_t trackPeerKind = 0, trackLastSeq = 0, trackCh = 0;

static void note(const char *msg) { Serial.print("# "); Serial.println(msg); }

// ---- display -----------------------------------------------------------------------------------------------
static const uint16_t C_BG = 0x0000, C_FG = 0xFFFF, C_DIM = 0x9CD3, C_LINE = 0x31A6, C_ACCENT = 0x05FF;
static const uint16_t C_GOOD = 0x0680, C_FAIR = 0xFD20, C_POOR = 0xF800;

static uint16_t gradeColor(int dbm) {
  wl::Grade g = wl::grade(dbm);
  return g == wl::GOOD ? C_GOOD : g == wl::FAIR ? C_FAIR : C_POOR;
}

// Push the canvas to the panel in even-sized rows (the CO5300 wants even windows), as nori_watch_control does.
static void flushAll() {
  if (!ui) return;
  uint16_t *fb = ui->getFramebuffer();
  gfx->startWrite();
  gfx->writeAddrWindow(0, 0, LCD_W, LCD_H);
  for (int r = 0; r < LCD_H; r++) bus->writePixels(fb + (size_t)r * LCD_W, LCD_W);
  gfx->endWrite();
}

static void text(int x, int y, int size, uint16_t color, const char *s) {
  ui->setTextSize(size);
  ui->setTextColor(color);
  ui->setCursor(x, y);
  ui->print(s);
}

static void titleBar() {
  char t[32];
  snprintf(t, sizeof t, "%s", PAGE_NAMES[page]);
  text(SAFE_X + 10, SAFE_Y + 6, 3, C_ACCENT, t);
  // page dots
  for (int i = 0; i < PG_COUNT; i++) {
    int x = LCD_W / 2 - (PG_COUNT * 18) / 2 + i * 18 + 6;
    if (i == page) ui->fillCircle(x, SAFE_BOTTOM + 10, 5, C_FG);
    else ui->drawCircle(x, SAFE_BOTTOM + 10, 5, C_DIM);
  }
}

static gf::Peer peerAt(int i) {
  gf::Peer p;
  portENTER_CRITICAL(&peerMux);
  p = peers.p[i];
  portEXIT_CRITICAL(&peerMux);
  return p;
}

static void drawGroup() {
  char s[64];
  int y = SAFE_Y + 48;
  snprintf(s, sizeof s, "Watch: %d nets", heard);
  text(SAFE_X + 10, y, 2, C_FG, s);
  if (heard) {
    snprintf(s, sizeof s, "quietest 1/6/11: ch %d", chs.quietest1611());
    text(SAFE_X + 10, y + 20, 2, C_DIM, s);
  }
  y += 52;
  uint32_t now = millis();
  int shown = 0;
  for (int i = 0; i < 8 && y < SAFE_BOTTOM - 60; i++) {
    gf::Peer p = peerAt(i);
    if (!p.used) continue;
    shown++;
    bool stale = now - p.heardMs > PEER_STALE_MS;
    ui->drawFastHLine(SAFE_X, y - 6, SAFE_W, C_LINE);
    snprintf(s, sizeof s, "%s %04x  %lus", gf::kindName(p.f.kind), p.f.id, (unsigned long)((now - p.heardMs) / 1000));
    text(SAFE_X + 10, y, 3, stale ? C_DIM : C_ACCENT, s);
    y += 30;
    if (p.f.flags & gf::F_PAX) snprintf(s, sizeof s, "%u Wi-Fi devices", p.f.pax);
    else if (p.f.flags & gf::F_SCAN) snprintf(s, sizeof s, "%u nets, best ch %u %d", p.f.nets, p.f.bestCh, p.f.bestDbm);
    else snprintf(s, sizeof s, "no data yet");
    text(SAFE_X + 10, y, 2, stale ? C_DIM : C_FG, s);
    y += 22;
    if (p.f.flags & gf::F_TRACKING) {
      snprintf(s, sizeof s, "tracking ch %u: %d dBm", p.f.trackCh, p.f.trackDbm);
      text(SAFE_X + 10, y, 2, gradeColor(p.f.trackDbm), s);
      y += 22;
    }
    y += 12;
  }
  if (!shown) text(SAFE_X + 10, y, 2, C_DIM, "Listening for the group...");
}

static void drawTrack() {
  char s[64];
  gf::Peer best;
  for (int i = 0; i < 8; i++) {
    gf::Peer p = peerAt(i);
    if (p.used && (p.f.flags & gf::F_TRACKING) && (!best.used || p.heardMs > best.heardMs)) best = p;
  }
  if (!best.used) {
    text(SAFE_X + 10, SAFE_Y + 80, 2, C_DIM, "No T-Deck is tracking.");
    text(SAFE_X + 10, SAFE_Y + 104, 2, C_DIM, "Pick a network there");
    text(SAFE_X + 10, SAFE_Y + 128, 2, C_DIM, "and click the trackball.");
    return;
  }
  uint32_t age = (millis() - best.heardMs) / 1000;
  snprintf(s, sizeof s, "%s %04x  ch %u  %lus", gf::kindName(best.f.kind), best.f.id, best.f.trackCh, (unsigned long)age);
  text(SAFE_X + 10, SAFE_Y + 50, 2, C_DIM, s);
  int dbm = best.f.trackDbm;
  uint16_t col = age * 1000 > PEER_STALE_MS ? C_DIM : gradeColor(dbm);
  snprintf(s, sizeof s, "%d", dbm);
  text(SAFE_X + 20, SAFE_Y + 90, 10, col, s);
  text(SAFE_X + 20 + (int)strlen(s) * 60 + 8, SAFE_Y + 140, 3, col, "dBm");
  const char *warn = dbm < wl::kPoorDbm ? "POOR  below -75" : dbm < wl::kGoodDbm ? "FAIR  below -67" : "GOOD";
  text(SAFE_X + 20, SAFE_Y + 182, 3, col, warn);
  if (trackHist.total) {
    snprintf(s, sizeof s, "min %d  avg %d  max %d", trackHist.mn, trackHist.avg(), trackHist.mx);
    text(SAFE_X + 20, SAFE_Y + 220, 2, C_FG, s);
  }
  // graph, -30 top to -95 bottom, with the two thresholds
  const int gx = SAFE_X + 10, gy = SAFE_Y + 250, gw = SAFE_W - 20, gh = SAFE_BOTTOM - gy - 24;
  ui->drawRect(gx, gy, gw, gh, C_LINE);
  auto yOf = [&](int d) { d = constrain(d, -95, -30); return gy + (-30 - d) * (gh - 1) / 65; };
  for (int x = gx + 2; x < gx + gw - 2; x += 8) {
    ui->drawFastHLine(x, yOf(wl::kGoodDbm), 4, C_GOOD);
    ui->drawFastHLine(x, yOf(wl::kPoorDbm), 4, C_POOR);
  }
  for (int i = 1; i < trackHist.count; i++) {
    int x1 = gx + 2 + (i - 1) * (gw - 4) / 59, x2 = gx + 2 + i * (gw - 4) / 59;
    ui->drawLine(x1, yOf(trackHist.at(i - 1)), x2, yOf(trackHist.at(i)), gradeColor(trackHist.at(i)));
  }
}

static void drawChannels() {
  char s[48];
  int maxc = 4;
  for (int c = 1; c <= 13; c++) maxc = max(maxc, (int)chs.count[c]);
  const int x0 = SAFE_X + 6, w = (SAFE_W - 12) / 13, top = SAFE_Y + 70, base = SAFE_BOTTOM - 60;
  for (int c = 1; c <= 13; c++) {
    int x = x0 + (c - 1) * w;
    bool main = (c == 1 || c == 6 || c == 11);
    if (main) ui->fillRect(x, top - 20, w - 1, base - top + 44, 0x0841);
    int h = chs.count[c] * (base - top) / maxc;
    if (chs.count[c]) ui->fillRect(x + 3, base - h, w - 7, h, gradeColor(chs.strongest[c]));
    snprintf(s, sizeof s, "%d", c);   // two rows of labels, so 10..13 do not run together
    text(x + (c < 10 ? 7 : 1), base + 6 + ((c & 1) ? 0 : 20), 2, main ? C_ACCENT : C_DIM, s);
    if (chs.count[c]) {
      snprintf(s, sizeof s, "%u", chs.count[c]);
      text(x + 7, base - h - 18, 2, C_FG, s);
    }
  }
  ui->drawFastHLine(x0, base, 13 * w, C_LINE);
  if (scanNo) snprintf(s, sizeof s, "%d nets, scan %lu", heard, (unsigned long)scanNo);
  else snprintf(s, sizeof s, "first passive scan...");
  text(SAFE_X + 10, SAFE_Y + 44, 2, C_DIM, s);
}

static void render() {
  if (!displayOk) return;
  ui->fillScreen(C_BG);
  titleBar();
  switch (page) {
    case PG_GROUP: drawGroup(); break;
    case PG_TRACK: drawTrack(); break;
    case PG_CHANNELS: drawChannels(); break;
  }
  flushAll();
  dirty = false;
}

// ---- touch (FT3168, register layout as in nori_watch_control) ----------------------------------------------
// A touch must report 1-2 points and a first point on the panel; anything else is treated as noise.
static bool touchDown() {
  if (!touchOk) return false;
  Wire.beginTransmission(TP_ADDR);
  Wire.write((uint8_t)0x02);   // TD_STATUS, then P1 XH XL YH YL
  Wire.endTransmission(false);
  if (Wire.requestFrom((uint16_t)TP_ADDR, (size_t)5, true) != 5) return false;
  uint8_t n = Wire.read() & 0x0F;
  uint8_t xh = Wire.read(), xl = Wire.read(), yh = Wire.read(), yl = Wire.read();
  int x = ((xh & 0x0F) << 8) | xl, y = ((yh & 0x0F) << 8) | yl;
  return n >= 1 && n <= 2 && x < LCD_W && y < LCD_H;
}

// ---- group link ----------------------------------------------------------------------------------------------
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
  me.flags = (scanNo ? gf::F_SCAN : 0) | (displayOk ? gf::F_HW_DISPLAY : 0) | (touchOk ? gf::F_HW_INPUT : 0);
  me.nets = gf::sat8(heard);
  for (int c = 1; c <= 13; c++) me.chcount[c] = chs.count[c];
  me.bestCh = bestCh;
  me.bestDbm = bestDbm;
  uint8_t buf[gf::kAdvLen];
  size_t n = gf::encodeAdv(me, buf, sizeof buf);
  BLEAdvertisementData d;
  d.addData((char *)buf, n);
  adv->setAdvertisementData(d);
}

static void groupBegin() {
  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_BT);
  me.kind = gf::KIND_WATCH;
  me.id = (uint16_t)(mac[4] | (mac[5] << 8));
  BLEDevice::init("");
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_N0);   // 0 dBm
  adv = BLEDevice::getAdvertising();
#if defined(CONFIG_NIMBLE_ENABLED)   // core 3.x on the S3 runs NimBLE behind the same BLEDevice API
  adv->setAdvertisementType(BLE_GAP_CONN_MODE_NON);   // with no scan response: ADV_NONCONN_IND, nobody can connect
#else
  adv->setAdvertisementType(ADV_TYPE_NONCONN_IND);
#endif
  adv->setScanResponse(false);
  adv->setMinInterval(1600);   // 1 s, in 0.625 ms units
  adv->setMaxInterval(1600);
  updateBeacon();
  adv->start();
  bscan = BLEDevice::getScan();
  bscan->setAdvertisedDeviceCallbacks(&groupListener, true);
  bscan->setActiveScan(false);   // passive
  bscan->setInterval(100);       // ms; window = interval: listen all the time between Wi-Fi scans
  bscan->setWindow(100);
}

static void groupPoll() {
  if (!bscan || !bleScanDone || scanning) return;
  bscan->clearResults();
  bleScanDone = false;
  if (!bscan->start(5, bleScanComplete, false)) bleScanDone = true;
}

static void blePause() {
  if (!bscan || bleScanDone) return;
  bscan->stop();
  bleScanDone = true;
}

static uint8_t printedSeq[8];
static bool printed[8];
static void printPeerUpdates() {
  for (int i = 0; i < 8; i++) {
    gf::Peer p = peerAt(i);
    if (!p.used || (printed[i] && printedSeq[i] == p.f.seq)) continue;
    printed[i] = true;
    printedSeq[i] = p.f.seq;
    Serial.printf("# group %s %04x seq=%u flags=%u nets=%u pax=%u best=2g%u/%d track=2g%u/%d advert_rssi=%d\n",
                  gf::kindName(p.f.kind), p.f.id, p.f.seq, p.f.flags, p.f.nets, p.f.pax, p.f.bestCh, p.f.bestDbm,
                  p.f.trackCh, p.f.trackDbm, p.rssi);
    if (page == PG_GROUP) dirty = true;
  }
}

// Raw RGB565 dump of the canvas over USB serial, for checking the layout from the Mac (tools/shot.py).
static void screenshot() {
  render();
  Serial.setTxTimeoutMs(500);
  Serial.printf("# SHOT %d %d\n", LCD_W, LCD_H);
  Serial.flush();
  const uint8_t *p = (const uint8_t *)ui->getFramebuffer();
  size_t n = (size_t)LCD_W * LCD_H * 2;
  for (size_t i = 0; i < n; i += 512) Serial.write(p + i, min((size_t)512, n - i));
  Serial.println();
  Serial.println("# END");
  Serial.setTxTimeoutMs(10);
}

// A new advert from the tracking peer adds one point to the TRACK graph.
static void followTracker() {
  gf::Peer best;
  for (int i = 0; i < 8; i++) {
    gf::Peer p = peerAt(i);
    if (p.used && (p.f.flags & gf::F_TRACKING) && (!best.used || p.heardMs > best.heardMs)) best = p;
  }
  if (!best.used) return;
  if (best.f.kind != trackPeerKind || best.f.id != trackPeerId || best.f.trackCh != trackCh) {
    trackHist.clear();
    trackPeerKind = best.f.kind; trackPeerId = best.f.id; trackCh = best.f.trackCh;
    trackLastSeq = best.f.seq - 1;
  }
  if (best.f.seq != trackLastSeq) {
    trackHist.push(best.f.trackDbm);
    trackLastSeq = best.f.seq;
    if (page == PG_TRACK) dirty = true;
  }
}

// ---- Wi-Fi: passive scans only -------------------------------------------------------------------------------
static void startScan() {
  blePause();
  int16_t r = WiFi.scanNetworks(true, true, true, DWELL_MS, 0);   // async, hidden, PASSIVE, dwell, all channels
  scanning = (r == WIFI_SCAN_RUNNING);
  scanStartMs = millis();
  if (!scanning) nextScanMs = millis() + 2000;
}

static void finishScan(int n) {
  chs.clear();
  heard = n;
  bestCh = 0; bestDbm = -128;
  for (int i = 0; i < n; i++) {
    int ch = WiFi.channel(i), rssi = WiFi.RSSI(i);
    chs.add(ch, rssi);
    if (rssi > bestDbm) { bestDbm = rssi; bestCh = ch; }
  }
  if (!n) bestDbm = 0;
  WiFi.scanDelete();
  scanNo++;
  lastScanMs = millis();
  scanning = false;
  nextScanMs = millis() + SCAN_EVERY_MS;
  updateBeacon();
  Serial.printf("# scan %lu: %d networks in %lu ms\n", (unsigned long)scanNo, n, (unsigned long)(lastScanMs - scanStartMs));
  dirty = true;
}

// ---- setup / loop --------------------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(10);   // CDC write blocks with no host reading
  note("watch Wi-Fi analyzer " FW_VERSION ": group display, passive scans, never joins a network");

  Wire.begin(PIN_SDA, PIN_SCL, 400000);
  ui = new Arduino_Canvas(LCD_W, LCD_H, gfx, 0, 0, 0);
  displayOk = ui->begin();
  if (displayOk) {
    gfx->setBrightness(150);
    ui->fillScreen(C_BG);
    text(SAFE_X + 10, SAFE_Y + 60, 3, C_DIM, "Wi-Fi analyzer");
    flushAll();
  }
  pinMode(PIN_BOOT, INPUT_PULLUP);
  pinMode(PIN_TP_RST, OUTPUT);
  digitalWrite(PIN_TP_RST, LOW);
  delay(10);
  digitalWrite(PIN_TP_RST, HIGH);
  delay(300);
  Wire.beginTransmission(TP_ADDR);
  touchOk = Wire.endTransmission() == 0;

  WiFi.persistent(false);
  WiFi.setAutoReconnect(false);
  WiFi.mode(WIFI_STA);   // needed to scan; WiFi.begin() is never called
  esp_wifi_set_storage(WIFI_STORAGE_RAM);
  WiFi.setScanTimeout(13 * DWELL_MS * 4 + 3000);

  groupBegin();
  nextScanMs = millis() + 1000;
  render();
}

void loop() {
  uint32_t now = millis();
  // input: a tap (touch or BOOT) moves to the next page
  // A touch counts after two readings in a row (one stray read flipped pages on the bench, 2026-10-13).
  static bool touchWas = false, bootWas = false;
  static uint8_t touchRun = 0;
  static uint32_t lastTap = 0;
  touchRun = touchDown() ? (touchRun < 255 ? touchRun + 1 : 255) : 0;
  bool t = touchRun >= 2, b = digitalRead(PIN_BOOT) == LOW;
  if (((t && !touchWas) || (b && !bootWas)) && now - lastTap > 300) {
    page = (page + 1) % PG_COUNT;
    lastTap = now;
    dirty = true;
    Serial.printf("# page %s (%s)\n", PAGE_NAMES[page], t && !touchWas ? "touch" : "BOOT button");
  }
  touchWas = t; bootWas = b;

  while (Serial.available()) {   // test hooks: n = next page, S = screenshot
    int c = Serial.read();
    if (c == 'n') { page = (page + 1) % PG_COUNT; dirty = true; }
    else if (c == 'S') screenshot();
  }

  groupPoll();
  followTracker();
  printPeerUpdates();

  if (scanning) {
    int n = WiFi.scanComplete();
    if (n >= 0) finishScan(n);
    else if (now - scanStartMs > 13 * DWELL_MS * 4 + 3000) { esp_wifi_scan_stop(); WiFi.scanDelete(); scanning = false; nextScanMs = now + 2000; }
  } else if ((int32_t)(now - nextScanMs) >= 0) {
    startScan();
  }

  static uint32_t lastDraw = 0;
  if ((dirty && now - lastDraw > 150) || now - lastDraw > 1000) {
    render();
    lastDraw = now;
  }
  delay(10);
}
