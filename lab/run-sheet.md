# Run sheet

Copy this for each session. Fill in the times as you go, and use `lab/mark.sh` for the same notes so they land in the capture log.

- Run name: a2-runNN-____
- Date and place:
- Robot serial and firmware version:
- Network: capture machine, Wi-Fi name, band and channel:
- SIM in or out:
- Who is present, and is the room empty of other people:

| Time UTC | Phase | Robot state | What you did | Notes |
|---|---|---|---|---|
|  | Baseline | Off, on its charger or unplugged | Capture running, robot off for five minutes |  |
|  | Boot | Power on | Note the moment of power on |  |
|  | Idle | Standing, not connected to the app | Leave for ten minutes |  |
|  | Charging | On the charger | Ten minutes |  |
|  | App connected | Idle | Open the control app on the iPad, join the lab Wi-Fi |  |
|  | Update check | Idle | Only if the app offers it. Note whether it found an update |  |
|  | Walking | Under the app's control, on a stand or in a clear space | Two minutes |  |
|  | Manual control | Under the app's control | Two minutes of arm and head moves |  |
|  | Shutdown | Power off | Note the moment |  |

After the run, run `lab/summarize.sh` and record here:
- Names the robot asked for, with counts:
- Server names in TLS handshakes:
- Addresses with the most bytes, in each direction:
- Anything that surprised you:
- Open questions for the next run:
