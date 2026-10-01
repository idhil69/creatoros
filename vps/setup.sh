#!/bin/bash
# CreatorOS VPS installer — Ubuntu/Debian. Jalankan sebagai root:
#   curl -fsSL https://raw.githubusercontent.com/idhil69/creatoros/main/vps/setup.sh | bash
set -e

echo "== CreatorOS MediaMTX Multistream Station =="

# 1) Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/4] Install Docker…"
  curl -fsSL https://get.docker.com | sh
else
  echo "[1/4] Docker sudah ada ✓"
fi

# 2) Ambil file konfigurasi
echo "[2/4] Ambil konfigurasi…"
mkdir -p /opt/creatoros && cd /opt/creatoros
BASE=https://raw.githubusercontent.com/idhil69/creatoros/main/vps
for f in docker-compose.yml mediamtx.yml push.sh .env.example; do
  curl -fsSL "$BASE/$f" -o "$f"
done
chmod +x push.sh
[ -f .env ] || cp .env.example .env

# 3) Firewall (jika ufw aktif)
if command -v ufw >/dev/null 2>&1; then
  echo "[3/4] Buka port firewall…"
  ufw allow 1935/tcp || true
  ufw allow 8889/tcp || true
  ufw allow 8189/tcp || true
  ufw allow 8888/tcp || true
else
  echo "[3/4] ufw tidak ada — lewati"
fi

# 4) Jalankan
echo "[4/4] Start MediaMTX…"
docker compose up -d

IP=$(curl -fsSL ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "=============================================="
echo "✅ SELESAI! Stasiun multistream kamu siap."
echo ""
echo "  1. Edit tujuan platform :  nano /opt/creatoros/.env"
echo "     lalu                 :  cd /opt/creatoros && docker compose restart"
echo ""
echo "  2. Siarkan dari HP (Larix/OBS) ke:"
echo "     rtmp://$IP:1935/live"
echo "     (stream key: kosongkan / bebas)"
echo ""
echo "  3. Preview hasil: http://$IP:8888/live"
echo "  4. Log          : docker logs -f creatoros-mediamtx"
echo "=============================================="
