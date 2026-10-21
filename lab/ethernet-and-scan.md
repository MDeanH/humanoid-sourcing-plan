# A2 Ultra: wired link and depth-camera recording

Status: planning notes. Nothing here has been run against a real A2. Items marked "unverified" came from memory or a single source and must be checked on the robot before relying on them.

## 1. First contact on the Ethernet port

We do not yet know how the A2's port is addressed. AgiBot's X2 docs give fixed addresses (robot 10.0.1.2, developer machine 10.0.1.41); I found nothing equivalent for the A2, and the A2 Ultra product page does not list the port. So the first run is only to look.

1. Robot on its stand, Mac mini or Pi 5 plugged straight into the port.
2. Do not set an IP address yet. Listen: `sudo tcpdump -i <iface> -n -e -c 200` (on a Mac the iface is usually `en5` or similar for a USB adapter; check `networksetup -listallhardwareports`).
3. Note what the robot sends by itself: ARP, DHCP requests, mDNS, LLDP, multicast. The source addresses tell you its subnet.
4. Only then give your machine an address on that subnet, if the docs say the port is meant for developers.

Log it with `lab/mark.sh` as a "wired first contact" run.

## 2. Passive capture on a wire

Pick one.

**Managed switch with port mirroring.** Robot on one port, router on another, capture machine on the mirror port. Nothing in the path changes. Preferred.

**Pi 5 as an inline bridge.** The Pi 5 has one Ethernet port, so add a USB 3 Gigabit adapter. Untested sketch, non-persistent (it disappears at reboot, which is the point):

```
sudo ip link add br0 type bridge
sudo ip link set eth0 master br0
sudo ip link set eth1 master br0
sudo ip link set eth0 up; sudo ip link set eth1 up; sudo ip link set br0 up
IFACE=br0 lab/capture.sh a2-wired-run01
```

Caveats: NetworkManager may grab the ports, and if you manage the Pi over `eth0` you will cut yourself off, so manage it over Wi-Fi or a keyboard. The Pi is in the path, so if it fails, the robot's link drops. This bridges only; it must not route, rewrite or block anything.

The wired link may be an internal developer network that never reaches the internet. Capture the Wi-Fi side in the same run to see where the cloud traffic goes.

## 3. Recording the depth camera

AgiBot documents the A2's sensors as ROS 2 topics in the AimDK sensor-data guide: https://open.agibot.com/docs/en/aimdk/a2/v2_0/dev_guide/07-04-sensor_data . I have not read the developer-mode or network-access sections. Read them first. On the X2, developer mode disables the native motion control; the A2 may behave the same way.

What the A2 Ultra page lists: RGB-D head camera. Depth range I found for it: 0.3 to 10 m (unverified on this unit).

Recording needs a ROS 2 machine on the same network as the robot. The X2 SDK targets ROS 2 Humble, so assume Humble: Ubuntu 22.04 on the Pi 5, or Docker. ROS 2 on macOS is awkward; use the Mac mini for the reconstruction, not the recording.

This is not purely passive. Subscribing is read-only, but ROS 2 discovery sends packets (DDS multicast, which I believe defaults to 239.255.0.1 on UDP ports from 7400; unverified). Log these runs as "subscribe" runs, separate from "listen" runs.

Steps once the robot is reachable:

```
ros2 topic list
ros2 topic info <depth topic> -v
ros2 bag record -o a2-scan01 <colour topic> <depth topic> <camera-info topics> /tf /tf_static
```

Topic names come from the AimDK guide or from `ros2 topic list`; do not guess them. Check the frame rate with `ros2 topic hz` before recording. Uncompressed 1280x720 depth plus colour is large, so use a fast SSD and short takes.

## 4. Getting a clean 3D scan

- Keep the robot still and the object on a turntable at about 0.5 to 2 m, inside the depth range. The turntable gives the many viewpoints a scan needs without moving the robot.
- Matte, textured objects scan best. Shiny, transparent and black objects often fail on depth cameras.
- You need the camera intrinsics (the AimDK docs say calibration files are on the robot's Orin) or the camera-info topics.
- Reconstruct offline on the Mac mini with RTAB-Map or Open3D. I have not tested either against A2 data.
- Keep people, screens and documents out of frame. The colour stream can capture other people's data.

## 5. Pi 5 roles

- Recorder: sits on the Ethernet port and runs `ros2 bag record`. This is the practical first step.
- Handheld scanner: the Pi 5 with its own depth camera (Orbbec, OAK-D or RealSense), a screen and a battery. This does not use the A2's camera. Camera and Pi 5 compatibility and power draw are unverified.

## 6. Rules

Same as `README.md`: passive first, our own robot, an empty lab, hardware e-stop in reach, robot on a stand for anything that sends it a command, captures and bags stay private and outside the repo. Do not publish bags or scans of people. Check AgiBot's terms and the warranty before using developer mode.
