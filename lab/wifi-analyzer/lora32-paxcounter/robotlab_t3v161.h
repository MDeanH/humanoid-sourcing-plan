// clang-format off
// upload_speed 460800
// board esp32dev

#ifndef _ROBOTLAB_T3V161_H
#define _ROBOTLAB_T3V161_H

#include <stdint.h>

/* LilyGO TTGO LoRa32 T3 V1.6.1 (ESP32-PICO-D4, SX1276), listen-only build for the robot lab.
   Copied from Paxcounter's shared/hal/ttgov21new.h ("for boards labeled v1.6 or v1.6.1 on pcb") with one change:
   HAS_LORA is left undefined, so the LoRaWAN stack is not built and the SX1276 is never configured or keyed.
   Upload speed lowered from 921600: reads at 921600 and 460800 failed on this board's USB bridge on 2026-10-13. */

// #define HAS_LORA      1 // off: listen only
#define CFG_sx1276_radio 1 // HPD13A LoRa SoC

// local paxcount table on the SD card, if one is inserted
#define HAS_SDCARD  2      // this board has a SD MMC card-reader/writer
#define SDCARD_SLOTWIDTH 4 // 4-line interface

#define HAS_DISPLAY 1
#define HAS_LED (25) // green on board LED

#define BAT_MEASURE_ADC ADC1_GPIO35_CHANNEL // battery probe GPIO pin -> ADC1_CHANNEL_7
#define BAT_VOLTAGE_DIVIDER 2 // voltage divider 100k/100k on board

// Pins for I2C interface of OLED Display
#define MY_DISPLAY_SDA (21)
#define MY_DISPLAY_SCL (22)
#define MY_DISPLAY_RST NOT_A_PIN

// LoRa chip pins, listed so its chip select is known; unused while HAS_LORA is off
#define LORA_SCK  (5)
#define LORA_CS   (18)
#define LORA_MISO (19)
#define LORA_MOSI (27)
#define LORA_RST  (23)
#define LORA_IRQ  (26)
#define LORA_IO1  (33)
#define LORA_IO2  (32)

#endif
