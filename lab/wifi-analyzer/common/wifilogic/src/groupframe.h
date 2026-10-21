// The group link: each board puts a short summary in a non-connectable BLE advertisement, and the T-Deck and
// the watch listen (passive BLE scan, no scan requests). Nothing joins a network. This is the only thing the
// group transmits; the Wi-Fi side stays receive-only.
//
// Advertisement data, 27 bytes: one manufacturer-specific AD structure, no flags (non-connectable adverts do
// not need them).
//   [0]     26     AD length
//   [1]     0xFF   AD type: manufacturer specific
//   [2..3]  0xFFFF company ID, little-endian (reserved by the Bluetooth SIG for internal and test use)
//   [4..26] payload, 23 bytes:
//     0-1  'R' 'W'      magic
//     2    1            version
//     3    kind         1 T-Deck, 2 LoRa32 Paxcounter, 3 watch, 4 Mac
//     4-5  id           last two bytes of the board's MAC, little-endian
//     6    seq          +1 each time the data changes (a new scan or count)
//     7    flags        F_* below (bits 5-6 report the sender's display and input hardware)
//     8    nets         networks heard in the last scan (saturates at 255)
//     9-10 pax          Paxcounter's Wi-Fi device count, little-endian (when F_PAX)
//     11-17 chcount     networks per 2.4 GHz channel 1..13, one nibble each (saturates at 15),
//                       channel c in byte 11 + (c-1)/2, low nibble for odd c
//     18   best_ch      channel of the strongest network (0 if none)
//     19   best_dbm     its signal, signed
//     20   track_ch     channel of the tracked network (0 if not tracking)
//     21   track_dbm    its signal, signed
//     22   age_s        seconds since the data was measured (saturates at 255)
#pragma once
#include <stddef.h>
#include <stdint.h>
#include <string.h>

namespace gf {

constexpr uint16_t kCompanyId = 0xFFFF;
constexpr uint8_t kVersion = 1;
constexpr size_t kPayloadLen = 23;
constexpr size_t kMsdLen = 2 + kPayloadLen;   // company ID + payload: what BLE stacks return as "manufacturer data"
constexpr size_t kAdvLen = 2 + kMsdLen;       // with the AD length and type bytes

enum Kind : uint8_t { KIND_TDECK = 1, KIND_PAX = 2, KIND_WATCH = 3, KIND_MAC = 4 };
enum Flag : uint8_t {
  F_SCAN = 1,        // nets / chcount / best_* hold a scan
  F_PAUSED = 2,
  F_LOGGING = 4,     // writing to its SD card
  F_TRACKING = 8,    // track_* hold the tracked network
  F_PAX = 16,        // pax holds a Paxcounter count
  F_HW_DISPLAY = 32, // health: the display started
  F_HW_INPUT = 64,   // health: the keyboard or touch controller answered
};

struct Frame {
  uint8_t kind = 0;
  uint16_t id = 0;
  uint8_t seq = 0;
  uint8_t flags = 0;
  uint8_t nets = 0;
  uint16_t pax = 0;
  uint8_t chcount[14] = {0};   // index 1..13
  uint8_t bestCh = 0;
  int8_t bestDbm = 0;
  uint8_t trackCh = 0;
  int8_t trackDbm = 0;
  uint8_t ageS = 0;
};

inline const char *kindName(uint8_t k) {
  switch (k) {
    case KIND_TDECK: return "T-Deck";
    case KIND_PAX: return "LoRa32";
    case KIND_WATCH: return "Watch";
    case KIND_MAC: return "Mac";
    default: return "?";
  }
}

inline uint8_t sat8(unsigned v) { return v > 255 ? 255 : (uint8_t)v; }

// Manufacturer data as BLE stacks hand it over: company ID then payload. Returns bytes written (kMsdLen) or 0.
inline size_t encodeMsd(const Frame &f, uint8_t *out, size_t n) {
  if (n < kMsdLen) return 0;
  memset(out, 0, kMsdLen);
  out[0] = kCompanyId & 0xFF;
  out[1] = kCompanyId >> 8;
  uint8_t *p = out + 2;
  p[0] = 'R'; p[1] = 'W'; p[2] = kVersion; p[3] = f.kind;
  p[4] = f.id & 0xFF; p[5] = f.id >> 8;
  p[6] = f.seq; p[7] = f.flags; p[8] = f.nets;
  p[9] = f.pax & 0xFF; p[10] = f.pax >> 8;
  for (int c = 1; c <= 13; c++) {
    uint8_t v = f.chcount[c] > 15 ? 15 : f.chcount[c];
    p[11 + (c - 1) / 2] |= (c & 1) ? v : (uint8_t)(v << 4);
  }
  p[18] = f.bestCh; p[19] = (uint8_t)f.bestDbm;
  p[20] = f.trackCh; p[21] = (uint8_t)f.trackDbm;
  p[22] = f.ageS;
  return kMsdLen;
}

// The full advertisement data (AD length, type, then manufacturer data). Returns kAdvLen or 0.
inline size_t encodeAdv(const Frame &f, uint8_t *out, size_t n) {
  if (n < kAdvLen) return 0;
  out[0] = (uint8_t)(kAdvLen - 1);
  out[1] = 0xFF;
  return encodeMsd(f, out + 2, n - 2) ? kAdvLen : 0;
}

// Accepts manufacturer data (company ID first). False for anything that is not one of ours.
inline bool decodeMsd(const uint8_t *m, size_t n, Frame *f) {
  if (!m || n < kMsdLen) return false;
  if ((uint16_t)(m[0] | (m[1] << 8)) != kCompanyId) return false;
  const uint8_t *p = m + 2;
  if (p[0] != 'R' || p[1] != 'W' || p[2] != kVersion) return false;
  if (p[3] < KIND_TDECK || p[3] > KIND_MAC) return false;
  Frame g;
  g.kind = p[3];
  g.id = (uint16_t)(p[4] | (p[5] << 8));
  g.seq = p[6]; g.flags = p[7]; g.nets = p[8];
  g.pax = (uint16_t)(p[9] | (p[10] << 8));
  for (int c = 1; c <= 13; c++) {
    uint8_t b = p[11 + (c - 1) / 2];
    g.chcount[c] = (c & 1) ? (b & 0x0F) : (b >> 4);
  }
  g.bestCh = p[18]; g.bestDbm = (int8_t)p[19];
  g.trackCh = p[20]; g.trackDbm = (int8_t)p[21];
  g.ageS = p[22];
  *f = g;
  return true;
}

// Finds our manufacturer data inside raw advertisement data (a list of AD structures).
inline bool decodeAdv(const uint8_t *adv, size_t n, Frame *f) {
  size_t i = 0;
  while (i < n) {
    uint8_t len = adv[i];
    if (len == 0 || i + 1 + len > n) return false;
    if (adv[i + 1] == 0xFF && decodeMsd(adv + i + 2, len - 1, f)) return true;
    i += 1 + len;
  }
  return false;
}

// ---- what a listener keeps about each sender ---------------------------------------------------------------
struct Peer {
  Frame f;
  int8_t rssi = 0;          // how loud the advert arrived
  uint32_t heardMs = 0;     // when (receiver's uptime)
  bool used = false;
};

// A small table of peers keyed by (kind, id). Oldest entry is replaced when full.
template <int N> struct PeerTable {
  Peer p[N];
  int update(const Frame &f, int8_t rssi, uint32_t nowMs) {
    int slot = -1;
    for (int i = 0; i < N && slot < 0; i++)   // the same sender
      if (p[i].used && p[i].f.kind == f.kind && p[i].f.id == f.id) slot = i;
    for (int i = 0; i < N && slot < 0; i++)   // else a free slot
      if (!p[i].used) slot = i;
    if (slot < 0) {                           // else the one heard longest ago
      slot = 0;
      for (int i = 1; i < N; i++) if (p[i].heardMs < p[slot].heardMs) slot = i;
    }
    p[slot].f = f; p[slot].rssi = rssi; p[slot].heardMs = nowMs; p[slot].used = true;
    return slot;
  }
  int count() const { int c = 0; for (int i = 0; i < N; i++) c += p[i].used; return c; }
};

}  // namespace gf
