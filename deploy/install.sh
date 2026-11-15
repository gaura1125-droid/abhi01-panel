#!/usr/bin/env bash
# ABHI0.1 one-shot live deploy — Ubuntu 22.04/24.04 or Debian 12.
# Run from the extracted project root:  sudo bash deploy/install.sh <public-ip>
set -euo pipefail

PUBLIC_IP="${1:-$(curl -s --max-time 8 ifconfig.me || true)}"
if [ -z "$PUBLIC_IP" ]; then echo "usage: sudo bash deploy/install.sh <public-ip>"; exit 1; fi
APP_DIR=/opt/abhi
echo "[*] public ip: $PUBLIC_IP"

# --- node 22 LTS -------------------------------------------------------------
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  apt-get update -y
  apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y build-essential python3 ufw

# --- app ---------------------------------------------------------------------
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude logs --exclude _ref \
  --exclude 'factory/apk_builder/temp' ./ "$APP_DIR"/
cd "$APP_DIR"
[ -d node_modules ] || npm ci --omit=dev --unsafe-perm

node "$APP_DIR/deploy/configure.js" "$PUBLIC_IP"

# --- services ----------------------------------------------------------------
cp "$APP_DIR/deploy/abhi.service" /etc/systemd/system/
cp "$APP_DIR/deploy/abhi-apk.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now abhi abhi-apk
systemctl restart abhi abhi-apk

# --- firewall ----------------------------------------------------------------
ufw allow 22/tcp >/dev/null
ufw allow 3000/tcp >/dev/null
ufw allow 22222/tcp >/dev/null
ufw allow 3100/tcp >/dev/null
ufw --force enable >/dev/null || true

sleep 3
echo "=== status ==="
systemctl is-active abhi abhi-apk || true
echo
echo "PANEL  -> http://$PUBLIC_IP:3000"
echo "APK    -> http://$PUBLIC_IP:3100/ABHI0.1_test.apk"
echo "APK/WS -> http://$PUBLIC_IP:22222"
echo
echo "logs: tail -f /var/log/abhi.log"
