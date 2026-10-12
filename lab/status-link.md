# Status link: T-Deck and LilyGO T3 over LoRa

Purpose: while a capture or a recording runs on the Pi 5, send short status messages to the T-Deck so you can see them while standing at the robot. It carries text only. It is not an e-stop and never will be; the hardware e-stop stays in reach.

Parts:
- LilyGO T-Deck: the handheld (keyboard, screen).
- LilyGO TTGO LoRa32 T3 V1.6.1, marked 868/915: fixed node, plugged into the Pi 5 by USB. SX1276 version, so one board covers both bands. Set the region to US for 915 MHz in Florida.

## Check before flashing

Meshtastic lists this board as community-supported and says "Firmware support is phased out", advises against new purchases and unattended installs, and recommends the T3S3. Page: https://meshtastic.org/docs/hardware/devices/community-supported/lilygo/lora/ . It may still work today; it may stop working with newer firmware. If it fails, the simplest fix is a T3S3.

The page identifies the board by "T3_v1.6.1 20210104" on the silkscreen. Ours reads 20210134, which is not on the page; treat that as unconfirmed.

Battery: the page says early boards had a LiPo charging part that could overcharge the battery, and boards bought after 2021 should not, unless marked "T3_v1.6 20180606". Run the T3 from USB with no battery attached, and do not leave a LiPo on it unattended.

## Setup

1. Flash both devices with Meshtastic firmware from the official flasher linked from https://meshtastic.org (steps differ by board and version; follow the page).
2. Set both to region US. The CLI form is `meshtastic --set lora.region US`; the CLI page did not list valid region values, so confirm against https://meshtastic.org/docs/configuration .
3. Put both on a private channel of your own, not the default one. As I understand it the default channel key is public, so anyone nearby could read messages on it (unverified). Keep messages generic regardless: no serial numbers, no IP addresses, no names.
4. On the Pi 5: `pip3 install --upgrade "meshtastic[cli]"`.
5. Send a message: `meshtastic --sendtext 'capture running'`. List nodes with `meshtastic --nodes`.

## Hooking it to the lab scripts

Add a line to a run script, for example after `lab/mark.sh`:

```
meshtastic --sendtext "a2-run01: capture started" || true
```

The `|| true` stops a radio problem from killing a capture. Messages are about 200 bytes at most according to community forum posts (unofficial), so keep them short.

## Limits

LoRa is low bandwidth. It cannot carry camera or depth data, and it should not carry anything sensitive.
