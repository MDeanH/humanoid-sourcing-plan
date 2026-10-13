// Native tests for common/wifilogic (wifilogic.h, groupframe.h). Run: lab/wifi-analyzer/common/test/run.sh
#include "../wifilogic/src/groupframe.h"
#include "../wifilogic/src/wifilogic.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>

static int fails = 0, checks = 0;
#define CHECK(cond) do { checks++; if (!(cond)) { fails++; fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); } } while (0)
#define CHECK_STR(a, b) do { checks++; if (std::string(a) != std::string(b)) { fails++; fprintf(stderr, "FAIL %s:%d: \"%s\" != \"%s\"\n", __FILE__, __LINE__, std::string(a).c_str(), std::string(b).c_str()); } } while (0)

static void channelsFromFixture(const char *path) {
  std::ifstream in(path);
  CHECK(in.good());
  std::string line;
  int rows = 0;
  while (std::getline(in, line)) {
    if (line.empty() || line[0] == '#') continue;
    std::istringstream s(line);
    int band, ch, mhz; std::string want;
    s >> band >> ch >> mhz >> want;
    char a[8], b[8];
    bool okA = wl::channelName(band, ch, a, sizeof a);
    bool okB = wl::channelFromFreq(mhz, b, sizeof b);
    if (want == "-") { CHECK(!okA); CHECK(!okB); }
    else { CHECK(okA); CHECK(okB); CHECK_STR(a, want); CHECK_STR(b, want); }
    rows++;
  }
  CHECK(rows >= 20);
}

static void fields() {
  uint8_t b[6] = {0xAA, 0x0b, 0xC0, 0x01, 0x02, 0xff};
  char s[18]; wl::formatBssid(b, s);
  CHECK_STR(s, "aa:0b:c0:01:02:ff");
  char n[33]; wl::cleanName("cafe\tnet\nx", n, sizeof n);
  CHECK_STR(n, "cafe net x");
  char longname[40]; memset(longname, 'a', 39); longname[39] = 0;
  wl::cleanName(longname, n, sizeof n);
  CHECK(strlen(n) == 32);
  char t[16];
  wl::uptimeStamp(123456, t, sizeof t); CHECK_STR(t, "T+000123.4");
  wl::uptimeStamp(0, t, sizeof t); CHECK_STR(t, "T+000000.0");
  wl::uptimeStamp(1000000000u, t, sizeof t); CHECK_STR(t, "T+1000000.0");
  char line[96];
  int len = wl::scanLine(line, sizeof line, "T+000123.4", b, "2g6", -61, "Expo\tHall");
  CHECK(len > 0);
  CHECK_STR(line, "T+000123.4\taa:0b:c0:01:02:ff\t2g6\t-61\tExpo Hall");
  CHECK(wl::scanLine(line, sizeof line, "T+1", b, "2g6", 5, "x") == -1);    // positive dBm is not a reading
  CHECK(wl::scanLine(line, sizeof line, "", b, "2g6", -50, "x") == -1);
  CHECK(wl::scanLine(line, 20, "T+000123.4", b, "2g6", -50, "x") == -1);    // does not fit
  len = wl::scanLine(line, sizeof line, "T+000001.0", b, "2g1", -90, "");
  CHECK_STR(line, "T+000001.0\taa:0b:c0:01:02:ff\t2g1\t-90\t");             // hidden network: empty name, 5 fields
}

static void grades() {
  CHECK(wl::grade(-67) == wl::GOOD);
  CHECK(wl::grade(-40) == wl::GOOD);
  CHECK(wl::grade(-68) == wl::FAIR);
  CHECK(wl::grade(-75) == wl::FAIR);   // "below -75 is poor": -75 itself is not
  CHECK(wl::grade(-76) == wl::POOR);
}

static void history() {
  wl::History<4> h;
  CHECK(h.count == 0 && h.avg() == 0);
  int vals[] = {-60, -70, -80, -50, -65};
  for (int v : vals) h.push(v);
  CHECK(h.count == 4);
  CHECK(h.at(0) == -70 && h.at(3) == -65 && h.last() == -65);   // oldest dropped from the window
  CHECK(h.mn == -80 && h.mx == -50);                            // min/max over the whole track
  CHECK(h.avg() == -65);                                        // (-325) / 5
  h.clear(); h.push(-61); h.push(-62);
  CHECK(h.avg() == -62);                                        // -61.5 rounds to -62
}

static void channels() {
  wl::Net a[4] = {};
  a[0].rssi = -80; a[0].bssid[5] = 1; a[0].ch = 1;
  a[1].rssi = -40; a[1].bssid[5] = 2; a[1].ch = 6;
  a[2].rssi = -60; a[2].bssid[5] = 4; a[2].ch = 6;
  a[3].rssi = -60; a[3].bssid[5] = 3; a[3].ch = 11;
  wl::sortBySignal(a, 4);
  CHECK(a[0].rssi == -40 && a[1].bssid[5] == 3 && a[2].bssid[5] == 4 && a[3].rssi == -80);
  wl::ChannelSummary s;
  for (auto &n : a) s.add(n.ch, n.rssi);
  s.add(20, -30);   // ignored
  CHECK(s.count[6] == 2 && s.strong[6] == 2 && s.strongest[6] == -40);
  CHECK(s.count[1] == 1 && s.strong[1] == 0 && s.strongest[1] == -80);
  CHECK(s.strongest[3] == -128);
  CHECK(s.quietest1611() == 1);   // channel 1 has no network at -75 or stronger
}

static void groupFrames() {
  gf::Frame f;
  f.kind = gf::KIND_TDECK; f.id = 0xAD98; f.seq = 200; f.flags = gf::F_SCAN | gf::F_TRACKING;
  f.nets = 42; f.pax = 513;
  for (int c = 1; c <= 13; c++) f.chcount[c] = (uint8_t)c;
  f.chcount[13] = 99;   // saturates at 15
  f.bestCh = 6; f.bestDbm = -38; f.trackCh = 11; f.trackDbm = -77; f.ageS = 3;
  uint8_t adv[31];
  CHECK(gf::encodeAdv(f, adv, sizeof adv) == 27);
  CHECK(adv[0] == 26 && adv[1] == 0xFF && adv[2] == 0xFF && adv[3] == 0xFF && adv[4] == 'R' && adv[5] == 'W');
  CHECK(adv[4 + 11] == ((2 << 4) | 1));   // channels 1 and 2 share the first count byte
  gf::Frame g;
  CHECK(gf::decodeAdv(adv, 27, &g));
  CHECK(g.kind == f.kind && g.id == 0xAD98 && g.seq == 200 && g.flags == f.flags && g.nets == 42 && g.pax == 513);
  CHECK(g.chcount[1] == 1 && g.chcount[12] == 12 && g.chcount[13] == 15);
  CHECK(g.bestCh == 6 && g.bestDbm == -38 && g.trackCh == 11 && g.trackDbm == -77 && g.ageS == 3);
  // adverts that are not ours
  uint8_t other[27]; memcpy(other, adv, 27); other[2] = 0x4C; other[3] = 0x00;   // Apple's company ID
  CHECK(!gf::decodeAdv(other, 27, &g));
  memcpy(other, adv, 27); other[6] = 2;   // unknown version
  CHECK(!gf::decodeAdv(other, 27, &g));
  CHECK(!gf::decodeAdv(adv, 20, &g));     // truncated
  uint8_t withFlags[31] = {2, 0x01, 0x06};   // a flags AD first, then ours
  memcpy(withFlags + 3, adv, 27);
  CHECK(gf::decodeAdv(withFlags, 30, &g) && g.id == 0xAD98);
  uint8_t bad[4] = {9, 0xFF, 0xFF, 0xFF};    // length runs past the end
  CHECK(!gf::decodeAdv(bad, 4, &g));
  CHECK(gf::encodeAdv(f, adv, 26) == 0);
}

static void peers() {
  gf::PeerTable<2> t;
  gf::Frame a; a.kind = gf::KIND_PAX; a.id = 1;
  gf::Frame b; b.kind = gf::KIND_WATCH; b.id = 2;
  gf::Frame c; c.kind = gf::KIND_TDECK; c.id = 3;
  CHECK(t.update(a, -50, 100) == 0);
  CHECK(t.update(b, -60, 200) == 1);
  a.seq = 7;
  CHECK(t.update(a, -55, 300) == 0 && t.p[0].f.seq == 7 && t.p[0].rssi == -55);   // same sender, same slot
  CHECK(t.update(c, -70, 400) == 1);   // full: replaces the one heard longest ago (b at 200)
  CHECK(t.count() == 2 && t.p[1].f.kind == gf::KIND_TDECK);
}

int main(int argc, char **argv) {
  channelsFromFixture(argc > 1 ? argv[1] : "lab/wifi-analyzer/testdata/channel-cases.tsv");
  fields(); grades(); history(); channels(); groupFrames(); peers();
  printf("common: %d checks, %d failed\n", checks, fails);
  return fails ? 1 : 0;
}
