# Handoff: A2 Ultra stuck in initialization (`sm` dead)

For a Claude session running locally on the Mac mini. Written 2026-10-14 from a cloud session that could not reach the robot.

## Symptom
- Robot powers on (lights and fans) but stays silent. It never says "请连接遥控器" ("please connect the remote controller").
- The app shows: "请在机器人开机后，听到机器人播报【请连接遥控器】后再重试" ("After power-on, wait until the robot announces 'please connect the remote', then retry").

## What we found on the Orin
- Host `ubuntu-orin`, user `agi`. Software dir `/agibot`, logs in `/agibot/data/log`. Version banner partly visible: `A2_ULTRA-V1.5.3?-...` (blurry).
- `aima doctor` (run in `/agibot/data/log`): EM service running. About 25 processes Running (agivslam, cobridge, coencoder, colistener, data_exporter, data_proxy, embodied_agent, gateway, hal_audio, hal_lidar, hds, health_monitor1, iox_roudi, manipulator, mm, perception, pnc, recordbag1, resource_manager, setting1, skillpilot, slam, task_engine, tz_camera). **Only `sm` is dead** (实际状态 死亡). Health: no alarms, CPU 22.6%, memory 57.6%, disk 27.9%.
- AgiBot's AimDK docs describe SM as process status management (the state machine). Working theory: `sm` dying is why startup never reaches the "connect the remote" step. Unverified.
- Boot console also showed snap mount failures ("Can't lookup blockdev" for core20/core22/firefox/gnome/lxd/snapd), "Failed to start Snap Daemon", "Failed to start Load AppArmor profiles", and SSSD dependency failures. Disk is not full. These may be unrelated to `sm`.
- Process start times read 2026-10-14 07:53 while the desktop clock read Oct 13 17:23. Possible clock or timezone mismatch; unverified whether it matters.

## How to reach the Orin from the Mac
- Ethernet to the Orin debug port: Orin is `192.168.2.50` (fixed, per AimDK v1.3 docs). Set the Mac's Ethernet to `192.168.2.100/24`. Then `ssh agi@192.168.2.50`.
- USB: a USB cable is connected Mac to robot. If a new network interface appears (`networksetup -listallhardwareports`), try `ssh agi@192.168.55.1` (the default Jetson USB address; unverified on the A2). Do not hold any button while plugging in or powering on: that can enter recovery mode.
- Or the robot's own keyboard and monitor (the owner is logged in there).

## Do next (read-only first)
1. `aima --help`, and the help for its subcommands. Look for a supported way to see or restart `sm`.
2. In `/agibot/data/log`: `ls -lt | head -20` and `ls -lt | grep -i sm`. Read the last 60 to 100 lines of the newest `sm` log. Find why it exits.
3. `journalctl -b --no-pager | grep -iE 'sm|agibot_em' | tail -100` and `systemctl status agibot_em.service`.
4. Explain the cause to the owner in plain words before changing anything.
5. Copy relevant logs to `~/robot-lab-captures/a2-sm-dead/` on the Mac for AgiBot support (`scp`).

## Rules
- No edits, deletes, reinstalls, `sudo` or restarts on the robot without the owner's explicit OK. Prefer AgiBot's own `aima` commands over manual fixes. AgiBot support or the owner's tech may need to approve; warranty caution applies (see `lab/README.md`).
- Keep the robot on its stand or seated, with the hardware e-stop in reach, before any restart that could move it.
- Append findings to `RESEARCH_LOG.md` (start, end, duration, sources, conclusion, open questions).
- Owner preferences: plain prose, no emoji, one clarifying question max, flag anything unverified.
