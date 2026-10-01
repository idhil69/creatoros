#!/bin/bash
# CreatorOS — Oryx (SRS Stack) installer. Ubuntu/Debian, jalankan sebagai root:
#   curl -fsSL https://raw.githubusercontent.com/idhil69/creatoros/main/vps/srs/setup.sh | bash
set -e

echo "== CreatorOS Oryx (SRS) Multistream Station =="

if ! command -v docker >/dev/null 2>&1; then
  echo "[1/3] Install Docker…"
  curl -fsSL https://get.docker.com | sh
else
  echo "[1/3] Docker sudah ada ✓"
fi

echo "[2/3] Ambil konfigurasi…"
mkdir -p /opt/creatoros-srs && cd /opt/creatoros-srs
curl -fsSL https://raw.githubusercontent.com/idhil69/creatoros/main/vps/srs/docker-compose.yml -o docker-compose.yml

if command -v ufw >/dev/null 2>&1; then
  ufw allow 2022/tcp || true
  ufw allow 1935/tcp || true
  ufw allow 8080/tcp || true
  ufw allow 8000/udp || true
  ufw allow 10080/udp || true
fi

echo "[3/3] Start Oryx…"
docker compose up -d

IP=$(curl -fsSL ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "=============================================="
echo "✅ SELESAI! Buka web UI untuk setup:"
echo ""
echo "   http://$IP:2022"
echo ""
echo "  1. Buat password admin saat pertama buka"
echo "  2. Menu 'Streaming' → salin RTMP server+key untuk Larix"
echo "  3. Menu 'Multi-platform streaming' (Forwarding) →"
echo "     tempel RTMP YouTube/Facebook/IG/TikTok → aktifkan"
echo "  4. Siarkan dari Larix → semua platform on-air 🔴"
echo "=============================================="
