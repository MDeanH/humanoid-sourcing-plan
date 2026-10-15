# Venue dropouts: finding why the A2 loses signal in the hall

Status: a procedure and three scripts. The scripts were tested on Linux against stubbed Wi-Fi output only: no real adapter, no robot, no venue. Items marked "unverified" must be checked before relying on them.

This complements `venue-survey.md`, which is the one-time receive-only radio survey (exhibitor rules, the e-stop band on the Flipper, LoRa, the Mac's scan window). This note covers the robot's own links: which one drops, logging it through show hours, reading the numbers, and what to change.

The method in one line: find out which link drops, measure it at the booth in an empty hall and again with the crowd in, then change the one thing the numbers point to.

## 1. Which link is dropping

"Loses signal" can mean any of four things, and each has a different fix. Note the moment it happens with `lab/mark.sh`, what the iPad showed, and whether the robot kept running.

| Link | What it carries | What a drop looks like | How to measure it |
|---|---|---|---|
| iPad app to robot, over Wi-Fi | Control | The app shows disconnected or commands lag | `lab/linklog.sh` on the hotspot, optionally with `PING` |
| Robot to the internet | Cloud features, updates | The robot still obeys the app, but online features fail | AimDK says that with the x86 Wi-Fi on, traffic leaves over Wi-Fi; with it off, over the 5G module, which needs a SIM. Phone field test for the cellular side (section 3) |
| Wireless e-stop remote | Stop | The robot stops unexpectedly | Find its band first (`venue-survey.md`, before the visit, step 1). Whether the A2 stops when the remote's link drops is unverified |
| Not radio at all | | Drops that line up with walking or arm moves while the signal stays good | FIRST's event guide lists low batteries, brown-outs from motor current, loose wiring and static as common non-radio causes |

Unverified: how the control app reaches the A2. The AimDK overview (v1.3) says the Orin board has its own hotspot and that, from V1.2, the default turns the Orin's Wi-Fi off and lets the x86 board's Wi-Fi carry internet traffic. Check on the robot which network the iPad joins, because that is the link to measure.

## 2. Before the show

Venue rules first: `venue-survey.md`, step 2. Add two questions to that list: a channel assignment for the robot's network (5 GHz, outside the radar range, 20 MHz wide), and which carriers the venue's in-building cellular system carries in your hall. Convention centers often have such a system shared by several carriers, but coverage differs by venue and carrier.

If drops look like the robot being kicked off the network, FIRST's guide treats a capture showing deauthentication frames as the evidence. Take it to venue IT; venues themselves have been fined for blocking hotspots.

Then run the same loggers in the lab, with the robot at the distances it will work at the booth, so you know what normal looks like on this robot and this hotspot.

## 3. Log the link at the booth

Do at least two runs: one at load-in, when the hall is empty, and one during show hours. The hall changes between them. Show hours add hundreds of phones and hotspots, and people stand between the iPad and the robot. One outdoor study measured up to 40 dB of loss at 2.45 GHz when a body blocked the path (a worst case, not a typical figure), and a 2 to 6 GHz measurement found body loss rising with frequency (a student thesis). I found no figure for a crowd, which is why the show-hours run matters.

On the Raspberry Pi 5, with the hotspot on `wlan0` and a second USB Wi-Fi adapter on `wlan1` for scanning:

```
# every network heard, every 30 s, and how busy each channel is
IFACE=wlan1 OURS=A2-LAB lab/airscan.sh venue-run02-showhours

# second terminal: how the hotspot hears the robot and the iPad, every second
lab/linklog.sh venue-run02-showhours

# or, to also time round trips to the robot (sends one small ping a second, to our robot only)
PING=<robot address> lab/linklog.sh venue-run02-showhours

# third terminal: note where the robot is and what it is doing
lab/mark.sh venue-run02-showhours "robot at the far corner, walking"
```

Walk the robot, or carry the iPad, to every spot it will use, with the operator standing where they will stand, and mark each spot. Stop with Control-C. Each logger prints a summary and writes `summary/link.txt` and `summary/channels.tsv`; `lab/survey-summary.sh <run>` re-reads a run at any time. Without a second adapter, take the hotspot down and scan on `wlan0`, as `venue-survey.md` does.

On a Mac, `lab/linklog.sh` reads the Mac's own link through `sudo wdutil info` (untested on a Mac; recent macOS may redact network names there, which this script does not need).

On the iPad, Apple's AirPort Utility app has a Wi-Fi scanner that shows each network's signal and channel, switched on under Settings, AirPort Utility. The sources for this are from 2017 and 2018; unverified on current iPadOS.

A Wi-Fi scan cannot see Bluetooth, wireless audio and video senders, cordless phones and other non-Wi-Fi sources, all on FIRST's list of event culprits. A busy channel with few networks on it points to one of these, or to one heavy user such as a neighbour's live video feed. The Flipper covers only sub-GHz bands. For 2.4 and 5 GHz, a tinySA Ultra reaches about 5.3 GHz in its Ultra mode; the Ultra Plus ZS407 is the model for 5.8 and 6 GHz. Receive only.

Cellular: on a phone on the same carrier as the robot's SIM, the iPhone field test (dial `*3001#12345#`) shows the serving cell's RSRP in dBm, closer to zero is stronger. Menus differ by model, iOS version and carrier; unverified on current iOS. Compare the booth with the lobby, empty and full.

## 4. Reading the numbers

Rough guides: Clearpath treats -67 dBm or better as a good signal and below -75 dBm as poor, measured in each direction. FIRST treats a ping of 5 ms or less as very good, under 50 ms as responsive, and 250 ms or more as poor.

- Signal good, but losses, retries or long silences high: interference or a crowded channel. Pick a channel from `channels.tsv` with few networks at -75 dBm or stronger and a low busy share, and ask the venue for it.
- Signal falls below -75 dBm at some spots, or only in show hours: distance and bodies. Shorten the distance, keep line of sight, raise the access point above head height.
- Long silences for the robot but not the iPad: the robot's side. Its antenna position and the way it faces matter; where the A2's antennas sit is unverified.
- Drops line up with walking or arm moves in `runlog.tsv` while the signal stays good: power or software, not radio.
- Booth fine but cloud features fail: the robot's internet route. Check which path it is on (section 1) and the cellular reading.

## 5. Fixes, most reliable first

1. Wire what you can. Bring the booth's internet in on the venue's wired drop, not over Wi-Fi. For the robot, ask AgiBot whether the app or the demo can run over a wired port; the AimDK overview lists two debug ports (Orin, fixed 192.168.2.50; x86, DHCP), and whether the control app works over them is unverified.
2. Get a clean, venue-approved 5 GHz channel at 20 MHz, which Clearpath advises for crowded indoor spaces. Avoid radar (DFS) channels, 52 to 144 in the US, for the control link: an access point that detects radar must leave the channel, which Clearpath notes causes a break. 6 GHz needs Wi-Fi 6E on both ends; the A2's Wi-Fi generation is unverified.
3. Keep the link short and in line of sight, with the access point above the crowd. Clearpath advises more access points at lower power rather than one loud one.
4. Tell the neighbouring booths your channel. Exhibitor Wi-Fi guidance from one venue provider recommends sharing wireless plans with adjacent booths.
5. Do not rely on cellular for control. If cloud features matter, use a SIM on a carrier the venue's in-building system carries.

## 6. Rules

Same as `README.md` and `venue-survey.md`. Our robot only. Listen, do not interfere: never jam, never send deauthentication frames, never transmit on the e-stop's band. Run a hotspot at a venue only with the venue's approval. `airscan.tsv` holds the names of other people's networks, so it stays private with the other captures.

## Sources

- AgiBot A2 Ultra product page: https://agibot.com/products/A2_Ultra (Wi-Fi and 4G/5G).
- AgiBot AimDK A2 overview, v1.3: https://open.agibot.com/docs/en/aimdk/a2/v1_3/dev_guide/01-a2_overview (Orin hotspot, NAT routing, 5G fallback, debug ports).
- FIRST Tech Challenge, troubleshooting wireless at events: https://ftc-docs.firstinspires.org/control_system_troubleshooting/troubleshooting_wireless_at_events/troubleshooting-wireless-at-events.html
- Clearpath Robotics, Wi-Fi fundamentals: https://docs.clearpathrobotics.com/docs/ros/networking/wifi_fundamentals
- Exhibitor Wi-Fi guidance (2017 flyer): https://www.aapm.org/meetings/2017AM/Exhibits/documents/WifiFlyer.pdf
- In-building cellular at convention centers (press releases): https://www.tsnn.com/convention-center/cox-business-insite-partner-with-las-vegas-convention-center-on-wireless-service , https://test.tsnn.com/node/677401
- Body loss: UCC outdoor body-to-body study, https://research.ucc.ie/en/publications/received-signal-characteristics-of-outdoor-body-to-body-communica/ ; 2 to 6 GHz tissue study, https://jaree.its.ac.id/index.php/jaree/article/view/185
- AirPort Utility Wi-Fi scanner: https://eclecticlight.co/2018/05/01/apples-free-mobile-wi-fi-scanner/
- iPhone field test: https://docs.celona.io/en/articles/11159852-apple-ios-field-test-mode
- tinySA Ultra range: https://www.testandmeasurementtips.com/tinysa-ultra-a-low-cost-spectrum-analyzer-that-fits-in-your-pocket/ and https://www.sdrstore.eu/tinysa-ultra-vs-tinysa-ultra-plus-which-spectrum-analyzer-should-you-buy/
