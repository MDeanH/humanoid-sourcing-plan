// Pure logic shared by the ESP32 boards (T-Deck, watch, LoRa32): channel names, log lines, signal grades,
// signal history and per-channel summaries. No Arduino or ESP-IDF calls, so common/test/ checks it on a Mac.
#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

namespace wl {

// ---- signal thresholds (Clearpath, see lab/venue-dropouts.md) -------------------------------------------
constexpr int kGoodDbm = -67;   // -67 dBm or better is good
constexpr int kPoorDbm = -75;   // below -75 dBm is poor

enum Grade : uint8_t { GOOD, FAIR, POOR };
inline Grade grade(int dbm) { return dbm >= kGoodDbm ? GOOD : (dbm < kPoorDbm ? POOR : FAIR); }
inline const char *gradeName(Grade g) { return g == GOOD ? "good" : g == FAIR ? "fair" : "poor"; }

// ---- channel names: 2g6, 5g36, 6g37 ---------------------------------------------------------------------
inline bool channelName(int bandGHz, int ch, char *out, size_t n) {
  // 20 MHz primaries: 5 GHz 32-144 and 149-177 in steps of 4; 6 GHz 1, 5, 9 ... 233
  bool ok = (bandGHz == 2 && ch >= 1 && ch <= 14) ||
            (bandGHz == 5 && ((ch >= 32 && ch <= 144 && ch % 4 == 0) || (ch >= 149 && ch <= 177 && (ch - 149) % 4 == 0))) ||
            (bandGHz == 6 && ch >= 1 && ch <= 233 && (ch - 1) % 4 == 0);
  if (!ok || n == 0) { if (n) out[0] = 0; return false; }
  return snprintf(out, n, "%dg%d", bandGHz, ch) < (int)n;
}

// Same ranges as chan() in lab/linklog.sh and lab/airscan.sh.
inline bool channelFromFreq(int mhz, char *out, size_t n) {
  if (mhz == 2484) return channelName(2, 14, out, n);
  if (mhz >= 2412 && mhz <= 2472 && (mhz - 2407) % 5 == 0) return channelName(2, (mhz - 2407) / 5, out, n);
  if (mhz >= 5160 && mhz <= 5885 && mhz % 5 == 0) return channelName(5, (mhz - 5000) / 5, out, n);
  if (mhz >= 5955 && mhz <= 7115 && (mhz - 5950) % 5 == 0) return channelName(6, (mhz - 5950) / 5, out, n);
  if (n) out[0] = 0;
  return false;
}

// ---- fields ---------------------------------------------------------------------------------------------
inline void formatBssid(const uint8_t b[6], char out[18]) {
  snprintf(out, 18, "%02x:%02x:%02x:%02x:%02x:%02x", b[0], b[1], b[2], b[3], b[4], b[5]);
}

// A network name safe for one TSV field: control characters (tab, newline...) become spaces.
inline void cleanName(const char *in, char *out, size_t n) {
  if (n == 0) return;
  size_t i = 0;
  for (; in && in[i] && i + 1 < n; i++) {
    unsigned char c = (unsigned char)in[i];
    out[i] = (c < 0x20 || c == 0x7f) ? ' ' : (char)c;
  }
  out[i] = 0;
}

// Boards with no clock stamp lines with uptime: T+000123.4 (seconds, tenths). Widens past 999999.9 s.
inline void uptimeStamp(uint32_t ms, char *out, size_t n) {
  snprintf(out, n, "T+%06lu.%lu", (unsigned long)(ms / 1000), (unsigned long)((ms % 1000) / 100));
}

// One airscan line: time, BSSID, channel, signal dBm, name. Returns the length, or -1 if it does not fit
// or a field is invalid (so a bad line is never written).
inline int scanLine(char *out, size_t n, const char *time, const uint8_t bssid[6], const char *channel, int rssi,
                    const char *ssid) {
  if (!time || !time[0] || !channel || !channel[0] || rssi > 0 || rssi < -120) return -1;
  char b[18], name[33];
  formatBssid(bssid, b);
  cleanName(ssid ? ssid : "", name, sizeof name);
  int len = snprintf(out, n, "%s\t%s\t%s\t%d\t%s", time, b, channel, rssi, name);
  return (len < 0 || (size_t)len >= n) ? -1 : len;
}

// ---- signal history for the track screen -----------------------------------------------------------------
template <int N> struct History {
  int16_t v[N];
  int count = 0, head = 0;   // head = next write slot
  long sum = 0;              // over everything pushed since clear(), for the average
  long total = 0;
  int mn = 0, mx = 0;

  void clear() { count = head = 0; sum = total = 0; mn = mx = 0; }
  void push(int dbm) {
    v[head] = (int16_t)dbm;
    head = (head + 1) % N;
    if (count < N) count++;
    if (total == 0 || dbm < mn) mn = dbm;
    if (total == 0 || dbm > mx) mx = dbm;
    sum += dbm;
    total++;
  }
  int at(int i) const { return v[(head - count + i + N) % N]; }   // 0 = oldest kept
  int last() const { return count ? at(count - 1) : 0; }
  int avg() const { return total ? (int)((sum - (total / 2)) / total) : 0; }   // rounds half away from zero for negatives
};

// ---- networks and the per-channel view --------------------------------------------------------------------
struct Net {
  uint8_t bssid[6];
  int8_t rssi;
  uint8_t ch;      // 2.4 GHz channel number (these boards hear 2.4 GHz only)
  char ssid[33];
};

// Strongest first; equal signals ordered by BSSID so the list does not jump between scans.
inline void sortBySignal(Net *a, int n) {
  for (int i = 1; i < n; i++) {
    Net k = a[i];
    int j = i - 1;
    while (j >= 0 && (a[j].rssi < k.rssi || (a[j].rssi == k.rssi && memcmp(a[j].bssid, k.bssid, 6) > 0))) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = k;
  }
}

struct ChannelSummary {
  uint8_t count[15];      // networks per 2.4 GHz channel, index 1..14
  uint8_t strong[15];     // of those, at -75 dBm or stronger
  int8_t strongest[15];   // strongest signal, or -128 if none
  void clear() { memset(count, 0, sizeof count); memset(strong, 0, sizeof strong); memset(strongest, -128, sizeof strongest); }
  ChannelSummary() { clear(); }
  void add(int ch, int rssi) {
    if (ch < 1 || ch > 14) return;
    if (count[ch] < 255) count[ch]++;
    if (rssi >= kPoorDbm && strong[ch] < 255) strong[ch]++;
    if (rssi > strongest[ch]) strongest[ch] = (int8_t)rssi;
  }
  // Of the non-overlapping channels 1, 6 and 11: fewest networks at -75 dBm or stronger, then the weakest
  // strongest signal, then the lowest channel.
  int quietest1611() const {
    int best = 1;
    const int cands[3] = {1, 6, 11};
    for (int c : cands) {
      if (strong[c] < strong[best] || (strong[c] == strong[best] && strongest[c] < strongest[best])) best = c;
    }
    return best;
  }
};

}  // namespace wl
