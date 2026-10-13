# Venue RF survey: one pass before the A2 goes on the show floor

Purpose: one listening session at the convention center to learn which radio bands are crowded, so we pick channels, settings and fallbacks that keep the A2 Ultra working during the show. Receive only. Nothing here transmits on anyone else's channel, blocks anyone, or records anyone's data.

What this cannot do: stop other people's radios. No device of ours may do that. Jamming, deauthenticating or blocking other people's signals is illegal under 47 U.S.C. 333, and the FCC has fined venue operators themselves for blocking attendees' hotspots, including one case at the Orange County Convention Center. What prevents interference is good channel choice, venue coordination, and a plan for when a link degrades.

## What each tool can see

| Band | What uses it | Tool |
|---|---|---|
| 300-348, 387-464, 779-928 MHz | E-stop remote (band not yet known), key fobs, venue radios, other exhibitors' LoRa | Flipper Zero, Frequency Analyzer |
| 902-928 MHz LoRa | Our status link, other Meshtastic nodes | T-Deck and T3, running Meshtastic |
| 2.4 GHz Wi-Fi | Robot Wi-Fi, iPad app, venue Wi-Fi, hotspots | Pi 5 (the LilyGO boards can also scan this band) |
| 5 GHz Wi-Fi | Robot Wi-Fi if it supports 5 GHz | Pi 5 or Mac mini only |
| 6 GHz Wi-Fi | Venue Wi-Fi 6E or 7 | Mac mini, if its Wi-Fi is 6E or 7 |
| 4G/5G cellular | Robot's cellular link | None of these. Watch signal bars and the carrier's usage page |

The Flipper and both LilyGO boards are blind to 5 GHz, and the robot's Wi-Fi is its main link. Bring the Pi 5 to cover that gap.

## Before the visit (in the lab)

1. Find the e-stop band. Robot on its stand, hardware e-stop in reach. Open Sub-GHz, Frequency Analyzer on the Flipper, hold it near the e-stop remote, press the remote. Write down the frequency. If the analyzer shows nothing, the remote is probably outside the Flipper's bands, likely 2.4 GHz. Note that and rely on the Wi-Fi survey for that band. Never save, replay or emulate the e-stop signal.
2. Read the venue's exhibitor rules. Look for the wireless or "personal network" section of the exhibitor kit and contract. Many venues ban exhibitor access points outright and require you to buy their Wi-Fi. If so, our lab Wi-Fi plan does not apply on the floor, and the question becomes whether the venue will give us a dedicated SSID or a wired drop. Ask exhibitor services or the venue's IT team who coordinates frequencies, and whether they run wireless intrusion prevention. Such a system may contain an exhibitor's access point it classes as rogue.
3. Flash the T-Deck and T3 with Meshtastic on our private channel, as in `status-link.md`.
4. Pick the visit time. An empty hall during move-in is far quieter than a hall on opening morning. Ideally survey during a live show in the same hall. Otherwise do it at move-in and treat the numbers as a best case.

## The survey (about 90 minutes)

Pick three spots: our booth, the farthest point the robot will walk to, and a point near the loading dock or a wall of other booths. Do every step at each spot, and log each with `lab/mark.sh venue-survey "spot 1 start"`.

**Wi-Fi, on the Pi 5.** Take down the lab access point first (`sudo nmcli con down a2-lab`), then log a scan every 30 seconds for ten minutes:

```
for i in $(seq 20); do
  sudo iw dev wlan0 scan | awk -v t="$(date -u +%FT%TZ)" '/^BSS/{b=substr($2,1,17)} /^\tfreq:/{f=$2} /^\tsignal:/{s=$2} /^\tSSID:/{sub(/^\tSSID: ?/,""); print t"\t"b"\t"f"\t"s"\t"$0}' >> ~/robot-lab-captures/venue-wifi.tsv
  sleep 30
done
```

Columns: time, access point address, frequency in MHz, signal in dBm, network name. The parser was tested on sample output, not on a Pi at a venue.

**Wi-Fi on the Mac mini instead.** Use the Wireless Diagnostics app: hold Option, click the Wi-Fi icon in the menu bar, open Wireless Diagnostics, then choose Window, Scan. It lists nearby networks with channel, band, signal and noise, and suggests channels. Take a screenshot at each spot and time. Do not plan on a scripted log: Apple deprecated the `airport` command in macOS 14.4, its replacement `wdutil` needs sudo, and recent versions redact network names in command-line output unless an app has Location Services permission. A Mac mini with Wi-Fi 6E or 7 also sees 6 GHz, which the Pi 5 cannot. It needs mains power and a screen, so it suits the booth spot; the Pi 5 on a battery pack walks to the other two. Skip the Sniffer window: it records every device's frames on a channel, and that is more than this survey needs. The meshtastic CLI also runs on the Mac, so the Mac can host the T3 instead of the Pi.

**E-stop band, on the Flipper.** With our remote switched off, run the Frequency Analyzer for ten minutes at each spot. It shows only the strongest signal above about -90 dBm, so note every reading within about 1 MHz of the e-stop frequency, with the time. Hits there mean the band is shared on site. Do not use Read RAW at the venue; it would record other people's key fobs and radios.

**LoRa, on the T-Deck and T3.** Leave the T3 on the Pi at the booth. Walk the T-Deck to each spot and send a short test message from each. Note whether it arrived and the signal and SNR shown for it. Also note how many other Meshtastic nodes show up and the channel-use figure the device reports. Other nodes share the same airtime as our status link, even on a private channel. Signal, SNR and channel-use readouts are from memory of the Meshtastic screens and unverified.

## Reading the results

- **Wi-Fi.** Count access points per channel and note the strongest. In 2.4 GHz only channels 1, 6 and 11 do not overlap; pick the one with the fewest strong networks, or move to 5 GHz if the robot supports it. On 5 GHz, prefer channels outside the radar-sharing range (36-48 or 149-165), because radar-sharing channels can force a channel change mid-show. If the venue bans our access point, take these numbers to the venue's IT team when asking for a dedicated network.
- **E-stop.** If its frequency is busy, rehearse the stop at the farthest spot during the busiest hour, and keep the hardware e-stop on the robot reachable by a person at all times. A wireless e-stop that sometimes misses is a reason to shrink the robot's operating area, not to push on.
- **LoRa.** If test messages fail or the channel is busy, the status link is a nice-to-have. Do not rely on it during the show.
- **Cellular.** If the robot's bars drop sharply when the hall fills, assume its cloud features may stall.

Write the outcome on the run sheet: chosen Wi-Fi band and channel, e-stop frequency and whether it was shared, LoRa result, and what the venue said about access points.

## Rules

Same as `README.md`: receive only, nothing saved that belongs to other people, the hardware e-stop in reach whenever the robot moves. The Wi-Fi log holds other networks' names and addresses; keep it outside the repo and share only counts per channel.
