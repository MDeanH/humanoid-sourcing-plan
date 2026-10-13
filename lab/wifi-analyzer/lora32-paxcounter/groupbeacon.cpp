// Robot-lab group link for Paxcounter. See groupbeacon.h.
#include "globals.h"
#include "groupbeacon.h"
#include "groupframe.h"
#include <BLEDevice.h>
#include <BLEAdvertising.h>
#include <esp_mac.h>

static BLEAdvertising *adv = nullptr;
static gf::Frame frame;

static void publish(void) {
  if (!adv) return;
  uint8_t buf[gf::kAdvLen];
  size_t n = gf::encodeAdv(frame, buf, sizeof buf);
  if (!n) return;
  BLEAdvertisementData d;
  d.addData(std::string((const char *)buf, n));
  adv->setAdvertisementData(d);   // takes effect while advertising
}

void groupbeacon_init(void) {
  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_BT);
  frame.kind = gf::KIND_PAX;
  frame.id = (uint16_t)(mac[4] | (mac[5] << 8));
  frame.flags = 0;   // no count yet

  BLEDevice::init("");
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_N0);   // 0 dBm: across a booth, not across the hall
  adv = BLEDevice::getAdvertising();
  adv->setAdvertisementType(ADV_TYPE_NONCONN_IND);
  adv->setScanResponse(false);
  adv->setMinInterval(1600);   // 1600 x 0.625 ms = 1 s
  adv->setMaxInterval(1600);
  publish();
  adv->start();
  ESP_LOGI(TAG, "Group beacon on: kind=%d id=%04x, 1 advert/s, 0 dBm", frame.kind, frame.id);
}

void groupbeacon_update(uint16_t wifi_count) {
  frame.pax = wifi_count;
  frame.flags = gf::F_PAX;
  frame.seq++;
  publish();
  ESP_LOGI(TAG, "Group beacon: wifi devices=%u seq=%u", wifi_count, frame.seq);
}
