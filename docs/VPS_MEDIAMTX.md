# VPS + MediaMTX — Stasiun Multistream Pribadi (Solusi Terbaik)

Arsitektur profesional: siarkan **sekali** dari HP, VPS menggandakan ke
**YouTube + Facebook + Instagram + TikTok** serentak — **tanpa transcode**
(`-c copy`), jadi VPS murah $4–6/bulan pun sanggup.

```
📱 Larix (H.264, RTMP) ──▶ 🖥 VPS MediaMTX ──┬─▶ 🔴 YouTube  (chat asli → CreatorOS)
     1x upload                 ffmpeg tee    ├─▶ 🔵 Facebook
     (hemat kuota HP)          -c copy       ├─▶ 🟣 Instagram
                               CPU ~nol      └─▶ ⚫ TikTok
```

Keunggulan vs relay Railway: tanpa transcode (CPU nyaris nol), latensi lebih
rendah, RTMP masuk = protokol paling stabil dari HP, dan 100% milikmu.

---

## LANGKAH 1 — Sewa VPS (±5 menit)

Pilih salah satu (spek cukup: **1 vCPU, 1 GB RAM**, OS **Ubuntu 22.04/24.04**):

| Provider | Harga | Catatan |
|---|---|---|
| DigitalOcean | $6/bln | Region Singapore |
| Vultr | $5–6/bln | Region Singapore |
| Contabo | ~$5/bln | Murah, spek besar |
| IDCloudHost / Niagahoster | ~Rp50–75rb/bln | Lokal Indonesia, bayar rupiah |

Catat **IP publik** VPS setelah jadi.

## LANGKAH 2 — Instal otomatis (1 perintah, ±3 menit)

SSH ke VPS (`ssh root@IP-VPS`), lalu jalankan:

```bash
curl -fsSL https://raw.githubusercontent.com/idhil69/creatoros/main/vps/setup.sh | bash
```

Script otomatis: install Docker → unduh konfigurasi → buka firewall → start MediaMTX.

## LANGKAH 3 — Isi tujuan platform (sekali)

```bash
nano /opt/creatoros/.env
```

Isi `RTMP_TARGETS` — semua tujuan digabung dengan tanda `|`:

```
RTMP_TARGETS=rtmps://a.rtmps.youtube.com:443/live2/KEY-YT|rtmps://live-api-s.facebook.com:443/rtmp/KEY-FB
```

| Platform | Cara ambil key |
|---|---|
| **YouTube** | Panel merah CreatorOS → Stream key (PERMANEN — isi sekali selamanya) |
| **Facebook** | facebook.com/live/producer → Streaming software → aktifkan **Persistent stream key** (permanen) |
| **Instagram** | instagram.com/live/producer (akun Professional) — key berubah tiap sesi |
| **TikTok** | TikTok Live Studio / livecenter.tiktok.com (butuh akses LIVE) |

Simpan (Ctrl+O, Enter, Ctrl+X) lalu:

```bash
cd /opt/creatoros && docker compose restart
```

## LANGKAH 4 — Hubungkan CreatorOS

Live Center → kolom **VPS MediaMTX** → isi:

```
rtmp://IP-VPS-KAMU:1935/live
```

(Tersimpan permanen di HP. Kosongkan kolom Relay & Livepeer.)

## LANGKAH 5 — Siaran!

1. **Mulai Live** di CreatorOS (broadcast YouTube + chat dibuat otomatis)
2. Panel merah → ketuk **"📲 Siarkan via Larix → VPS MediaMTX"** — Larix terbuka,
   VPS sudah terpasang otomatis
3. Tekan **tombol merah** di Larix → semua platform on-air 🔴 (10–30 dtk)
4. Kembali ke CreatorOS: chat & penonton YouTube asli mengalir; moderasi & statistik hidup
5. Selesai → stop di Larix + **Akhiri siaran** di CreatorOS

## Verifikasi & Operasional

```bash
docker logs -f creatoros-mediamtx     # log: "[push] mulai: ... → N target"
```
- Preview hasil ingest: `http://IP-VPS:8888/live`
- Ganti tujuan kapan pun: edit `.env` → `docker compose restart`
- Update MediaMTX: `docker compose pull && docker compose up -d`

## Troubleshooting

| Gejala | Solusi |
|---|---|
| Larix tidak bisa connect ke VPS | Cek firewall port **1935** terbuka (`ufw status`); cek IP benar |
| Platform tertentu tidak tayang | `docker logs` — lihat error ffmpeg untuk URL target itu (key salah/kadaluarsa) |
| Semua target diam | `RTMP_TARGETS` kosong/typo — pastikan dipisah `|` tanpa spasi, lalu restart |
| IG/FB perlu klik "Go Live" | Buka halaman producer platform tsb, tekan Go Live saat preview muncul (aturan mereka) |

## Bonus: ingest dari browser (tanpa Larix)

MediaMTX juga menerima **WHIP** di `http://IP-VPS:8889/live/whip` dengan
**ICE-TCP (port 8189)** — bisa tembus jaringan yang memblokir UDP. Jika suatu
saat ingin kembali siaran dari browser, opsi ini tersedia tanpa konfigurasi tambahan.
