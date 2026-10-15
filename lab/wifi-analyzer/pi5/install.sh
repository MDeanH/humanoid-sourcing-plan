#!/usr/bin/env bash
# Install the Wi-Fi analyzer on a Raspberry Pi 5 that already runs Raspberry Pi OS (Bookworm or Trixie).
#
#   sudo lab/wifi-analyzer/pi5/install.sh          (from a copy of this repo on the Pi)
#
# Installs to /opt/wifi-analyzer, adds three services (passive scans, Bluetooth group listener, dashboard on port
# 8765), tells NetworkManager to leave wlan0 alone, and puts the settings file on the boot partition.
# Logs: /var/lib/wifi-analyzer/captures/<run>/. Needs internet once for usbmuxd (iPhone USB tethering).
set -euo pipefail
[ "$(id -u)" = 0 ] || exec sudo "$0" "$@"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$HERE/.." && pwd)"
BOOT=/boot/firmware; [ -d "$BOOT" ] || BOOT=/boot

install -d /opt/wifi-analyzer/web/static /opt/wifi-analyzer/pi5
install -m 0644 "$SRC/web/analyzer.py" "$SRC/web/server.py" /opt/wifi-analyzer/web/
install -m 0644 "$SRC"/web/static/* /opt/wifi-analyzer/web/static/
install -m 0755 "$HERE/wifi_scan.py" "$HERE/group_listen.py" /opt/wifi-analyzer/pi5/
install -m 0644 "$HERE"/rootfs/etc/systemd/system/*.service /etc/systemd/system/
[ -f "$BOOT/wifi-analyzer.conf" ] || install -m 0644 "$HERE/boot/wifi-analyzer.conf" "$BOOT/wifi-analyzer.conf"

# Leaving wlan0 to the analyzer would drop a Wi-Fi SSH session, so keep it with NetworkManager if it is in use.
if nmcli -t -f DEVICE,STATE device 2>/dev/null | grep -q '^wlan0:connected'; then
  sed -i 's/^WIFI_CLIENT=.*/WIFI_CLIENT=yes/' "$BOOT/wifi-analyzer.conf"
  echo "wlan0 is connected (perhaps your SSH session): left with NetworkManager, WIFI_CLIENT=yes set."
  echo "For listen-only, reach the Pi by Ethernet or USB tethering, set WIFI_CLIENT=no and run this again."
else
  install -m 0644 "$HERE/rootfs/etc/NetworkManager/conf.d/90-wifi-analyzer.conf" /etc/NetworkManager/conf.d/
  systemctl reload NetworkManager 2>/dev/null || true
fi

command -v iw >/dev/null || apt-get install -y iw
if ! command -v usbmuxd >/dev/null; then
  apt-get install -y usbmuxd || echo "usbmuxd not installed (no internet?). iPhone USB tethering needs it: apt-get install usbmuxd"
fi

systemctl daemon-reload
systemctl enable wifi-analyzer-scan.service wifi-analyzer-group.service wifi-analyzer-web.service
systemctl restart wifi-analyzer-scan.service wifi-analyzer-group.service wifi-analyzer-web.service
sleep 3
systemctl --no-pager --lines=3 status wifi-analyzer-scan.service | sed -n '1,6p' || true
echo "Dashboard: http://$(hostname).local:8765   Logs: /var/lib/wifi-analyzer/captures/$(cat /run/wifi-analyzer/current-run 2>/dev/null || echo '<run>')/"
