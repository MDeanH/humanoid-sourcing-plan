#ifndef _GROUPBEACON_H
#define _GROUPBEACON_H

#include <stdint.h>

// Robot-lab group link for Paxcounter: puts the latest Wi-Fi device count in a non-connectable BLE
// advertisement (format in lab/wifi-analyzer/common/wifilogic/src/groupframe.h), so the T-Deck and the
// watch can show it. Transmit only; it accepts no connections and changes nothing in Paxcounter's counting.
void groupbeacon_init(void);
void groupbeacon_update(uint16_t wifi_count);

#endif
