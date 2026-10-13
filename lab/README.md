# Robot lab: passive listening to an A2 Ultra

Purpose: learn what our own A2 Ultra says on the network, by listening and logging only. Nothing here sends traffic to the robot, changes its settings, or touches anyone else's network.

What the A2 Ultra is listed with, from AgiBot's own pages: Wi-Fi and 4G/5G, no Bluetooth. A wireless e-stop remote ships in the box, with no radio type listed. This lab covers each link differently.

| Link | What this lab does |
|---|---|
| Wi-Fi | Capture at a gateway you control. You see names, addresses, ports, counts and timing. Content is mostly encrypted and we do not try to break that. |
| 4G/5G | Not captured. Intercepting cellular signals over the air is not possible in a useful way and is illegal. Compare runs with the SIM out and in, and read the carrier's usage page. |
| E-stop remote | Receive only, with the Flipper's frequency analyzer, to learn the band. Never transmit or replay it. |

## Rig

Robot and its control app both join a Wi-Fi network that your capture machine creates. The capture machine reaches the internet over Ethernet and listens on the Wi-Fi side. Use a Raspberry Pi 5 as the always-on gateway, with the Mac mini as the second option.

### Option A: Raspberry Pi 5 (recommended gateway)

A Pi is a dedicated box, leaves the Mac free, and cannot break your Mac's network settings. Plug the Pi into your router by Ethernet. Raspberry Pi OS Bookworm uses NetworkManager, which can share the connection with no extra software. Guides differ in detail, so check these against your OS version.

```
sudo apt update && sudo apt install -y tcpdump tshark
sudo nmcli con add type wifi ifname wlan0 con-name a2-lab ssid A2-LAB \
  802-11-wireless.mode ap 802-11-wireless.band bg \
  ipv4.method shared \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "choose-a-long-passphrase"
sudo nmcli con up a2-lab
```

`band bg` is 2.4 GHz and `a` is 5 GHz. If the robot will not join, try 2.4 GHz and WPA2. The capture interface is `wlan0`, which is the default on Linux.

### Option B: Mac mini

Menu names move between macOS versions, so treat these as a guide. Turn on Internet Sharing in System Settings under General then Sharing, share from Ethernet to Wi-Fi, and set a network name, channel and WPA2 password in Wi-Fi Options. The capture interface is `bridge100`, which is the default on a Mac. Do not edit the Mac's firewall rules for this: one developer reported that a rule on `bridge100` broke the hotspot until a restart.

Check the interface and see who has joined:

```
ifconfig bridge100
arp -a
sudo tcpdump -D
```

## Run a capture

Install Wireshark from wireshark.org on the machine you analyse on; it includes `tshark`. Then, from the repo root on the capture machine:

```
lab/capture.sh a2-run01-boot
```

In a second terminal, note each phase as it happens, so the log can be matched to the capture:

```
lab/mark.sh a2-run01-boot "robot powered on"
lab/mark.sh a2-run01-boot "app connected"
```

Stop with Control-C. Files rotate every ten minutes and sit in `~/robot-lab-captures/<run-name>/`, outside the repo on purpose. Then summarize:

```
lab/summarize.sh a2-run01-boot
```

This writes small tables to `~/robot-lab-captures/<run-name>/summary/`: names asked for, TLS server names, and bytes per address pair. By default the capture keeps the first 512 bytes of each packet, which is enough to read DNS names and TLS server names. Set `SNAP=96` for headers only; names may then be cut short and TLS server names will be missing.

## What to run

Use `run-sheet.md`. In short: robot off for a baseline, power on and idle, charging, app connected, walking, manual control, and an update check if the app offers one. Repeat once with the SIM out to see what the cellular link carries.

## Capturing the iPad's own traffic (optional)

The control app's traffic can be captured from a Mac over USB with the Remote Virtual Interface. This is the documented method; I could not confirm it on the newest macOS and Xcode, so check Apple's notes for your version.

```
xcrun xctrace list devices
rvictl -s <UDID-of-the-iPad>
sudo tcpdump -i rvi0 -s 512 -w ipad-app-run01.pcap
rvictl -x <UDID-of-the-iPad>
```

## Rules

- Stay passive. Do not replay, inject, jam, or clone anything, including the e-stop remote.
- Test only our own robots, on our own network, in an empty lab. The robot's camera and microphone may carry other people's data. Florida requires all-party consent to record private conversations.
- Capture files stay private. They are stored outside the repo, so they cannot be committed or deployed by accident, and they must never be sent to a supplier. Share only the summary tables, and check them for anything sensitive first.
- Check AgiBot's terms and the warranty before any step that goes beyond listening.
- Keep a hardware e-stop within reach for any test that moves the robot. The robot goes on a stand for anything that sends it a command.

## More notes

- `ethernet-and-scan.md`: the A2's Ethernet port, wired capture, and recording the depth camera. Planning notes, not run yet.
- `status-link.md`: T-Deck and LilyGO T3 as a LoRa status link. Planning notes, not run yet.
- `venue-survey.md`: one receive-only radio survey at the convention center with the Flipper, the LilyGO boards and the Pi 5. Planning notes, not run yet.
- `venue-dropouts.md`: when the robot loses signal at the venue: which link is dropping, logging it through show hours, reading the numbers, and fixes. Uses the three survey scripts below. Not run at a venue yet.

## Scripts

- `capture.sh <run>`: passive capture, rotating files, notes start and stop.
- `mark.sh <run> "note"`: timestamped note in `runlog.tsv`.
- `summarize.sh <run>`: tables from the capture files, using `tshark`.
- `linklog.sh <run>`: Wi-Fi signal, retries and silences every second, from the hotspot or this machine's link; optional ping with `PING`.
- `airscan.sh <run>`: every network heard and how busy each channel is, every 30 s. Linux only, on a second adapter.
- `survey-summary.sh <run>`: outage, signal and channel tables from those two logs.

Tested on Linux with generated traffic: rotation, notes, DNS names and TLS server names all came out correctly. Not yet run on a Mac or a Pi against a real robot.

The three survey scripts were tested on Linux against stubbed `iw`, `ping` and `wdutil` output, including an injected dropout. They have not touched a real Wi-Fi adapter, a Mac, or the robot.
