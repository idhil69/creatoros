# Oryx (SRS Stack) — Multistream dengan Web UI

Alternatif MediaMTX memakai **SRS** (ossrs.io) — open-source gratis (MIT).
Varian **Oryx** menambahkan **web UI**: multistream ke YouTube/FB/IG/TikTok
diatur **klik-klik dari browser**, tanpa edit file config. Paling ramah untuk hobi.

```
📱 Larix (RTMP/SRT) ──▶ 🖥 VPS Oryx ──(Forwarding, diatur via web UI)──▶ YT + FB + IG + TikTok 🔴
```

## Instal (1 perintah)

SSH ke VPS (Ubuntu 22.04+, 1 vCPU/1 GB cukup):

```bash
curl -fsSL https://raw.githubusercontent.com/idhil69/creatoros/main/vps/srs/setup.sh | bash
```

## Setup via browser (±5 menit, sekali)

1. Buka `http://IP-VPS:2022` → buat password admin
2. Menu **Streaming** → lihat **RTMP server + stream key** milikmu, contoh:
   `rtmp://IP-VPS/live` + key `livestream`
3. Menu **Multi-platform streaming** (Forwarding):
   - **YouTube**: tempel `rtmps://a.rtmps.youtube.com:443/live2` + key permanen dari panel merah CreatorOS → aktifkan
   - **Facebook**: `rtmps://live-api-s.facebook.com:443/rtmp` + persistent key → aktifkan
   - **IG/TikTok**: idem dengan key masing-masing
4. Di CreatorOS → Live Center → kolom **VPS MediaMTX** isi:
   `rtmp://IP-VPS:1935/live/livestream`
   (tombol Larix 1-ketuk otomatis memakai alamat ini)

## Rutinitas siaran

1. **Mulai Live** di CreatorOS (broadcast + chat YouTube dibuat otomatis)
2. Ketuk **📲 Siarkan via Larix** → tombol merah → semua platform on-air 🔴
3. Chat & statistik YouTube asli tetap di CreatorOS

## Bonus Oryx

- **SRT ingest** (port 10080/udp) — lebih tahan sinyal jelek daripada RTMP; Larix mendukung SRT
- **DVR/rekaman** ke disk VPS dari web UI
- Monitor bitrate & status forwarding per platform di UI

## MediaMTX vs Oryx — pilih mana?

| Kamu tipe… | Pakai |
|---|---|
| Suka UI grafis, klik-klik, lihat status per platform | **Oryx** ✅ |
| Suka minimalis, RAM kecil, config file | MediaMTX |

Keduanya sudah tersedia di repo (`vps/` dan `vps/srs/`) — bisa dicoba dua-duanya
di VPS yang sama (matikan salah satu: `docker compose down` di foldernya).
