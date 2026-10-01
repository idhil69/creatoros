# CreatorOS Relay — Siaran dari HP Tanpa OBS, Kebal Blokir Jaringan

Banyak operator seluler/ISP memblokir **UDP/WebRTC** sehingga siaran browser
(WHIP/Livepeer) gagal. Relay ini menghindarinya total:

```
📱 Kamera HP ──MediaRecorder──▶ WebSocket (TCP 443 = jalur HTTPS, tak terblokir)
      ──▶ Relay (ffmpeg, transcode H.264+AAC) ──▶ RTMPS YouTube 🔴
```

Kode relay ada di folder `relay/` (Node.js + ffmpeg, ±100 baris).

## Deploy gratis di Railway (±5 menit)

1. Buka **railway.app** → login dengan GitHub.
2. **New Project → Deploy from GitHub repo** → pilih repo `creatoros`.
3. Setelah service dibuat → **Settings**:
   - **Root Directory**: `relay`
   - (Start command otomatis: `npm start`)
4. **Settings → Networking → Generate Domain** → salin domain, mis.
   `creatoros-relay-production.up.railway.app`
5. (Opsional, keamanan) **Variables** → tambah `RELAY_TOKEN` = string acak,
   lalu di URL relay tambahkan `?token=...` — tapi untuk pemakaian pribadi boleh dilewati.

> Alternatif: **Render.com** → New Web Service → repo ini → Root Directory `relay`
> → Environment Node → Start `npm start`. (Free tier Render "tidur" saat idle;
> buka URL relay-nya dulu ±30 dtk sebelum siaran.)

## Pakai di CreatorOS

1. Live Center → kolom **Relay URL** → isi: `wss://DOMAIN-RELAY-KAMU`
   (contoh: `wss://creatoros-relay-production.up.railway.app`)
2. Kosongkan kolom Livepeer (tidak diperlukan lagi).
3. **Mulai Live** (dengan YouTube LIVE ASLI) → izinkan kamera →
   banner: **"✅ Video terkirim via RELAY"**
4. 20–60 detik kemudian YouTube **🔴 LIVE**. Chat & statistik asli tampil di CreatorOS.

## Verifikasi & Troubleshooting

| Gejala | Solusi |
|---|---|
| "Tidak bisa terhubung ke relay" | Cek URL (harus `wss://`, tanpa slash akhir); buka `https://DOMAIN-RELAY` di browser — harus muncul `{"ok":true}` |
| Relay terhubung tapi YouTube diam | Lihat log service di Railway (ffmpeg error akan tampil); pastikan mulai live dari CreatorOS agar key YouTube aktif |
| Video patah-patah | Upload internet kecil — relay memakai 2 Mbps; pindah ke Wi-Fi |
| Render: gagal connect pertama kali | Free tier baru bangun dari tidur — tunggu 30 dtk, akhiri live, mulai lagi |

## 🎯 MULTISTREAM — YouTube + Facebook + Instagram + TikTok serentak

Relay mendukung banyak target sekaligus (ffmpeg `tee`): **satu upload dari HP,
dipecah ke semua platform di sisi server**. Jika satu platform putus, yang lain
tetap siaran (`onfail=ignore`).

Isi kolom target di Live Center **sekali** (tersimpan permanen di HP). Format
setiap kolom: **URL server + / + stream key digabung**.

### YouTube — otomatis ✅
Tidak perlu diisi. CreatorOS membuat broadcast + memakai key permanen "CreatorOS
Persistent" secara otomatis, lengkap dengan chat & penonton asli di aplikasi.

### Facebook — mudah, key persisten
1. Buka **facebook.com/live/producer** (login akun/halaman kamu)
2. Pilih **Streaming software** → aktifkan **Persistent stream key**
3. Gabungkan: `rtmps://live-api-s.facebook.com:443/rtmp/` + stream key
4. Tempel ke kolom Facebook. Catatan: kamu tetap perlu menekan **Go Live** di
   halaman producer Facebook saat pratinjau muncul (aturan Facebook).

### Instagram — akun Professional
1. Ubah akun IG ke **Professional** (Creator/Business) di aplikasi IG
2. Buka **instagram.com/live/producer** di desktop
3. Salin **URL** + **Stream key**, gabungkan jadi satu, tempel ke kolom Instagram
4. Seperti FB: tekan **Go live** di halaman producer saat pratinjau tampil.
   (Key IG berubah tiap sesi — salin ulang sebelum siaran.)

### TikTok — butuh akses LIVE
TikTok memberi RTMP hanya untuk akun dengan **akses LIVE** (umumnya ≥1.000
follower, via **TikTok Live Studio** di PC atau `livecenter.tiktok.com`):
1. Buka TikTok Live Studio → pilih **Stream via server (RTMP)**
2. Salin **Server URL** + **Stream key**, gabungkan, tempel ke kolom TikTok
3. Jika belum punya akses LIVE, kolom ini dikosongkan saja — platform lain tetap jalan.

> 💡 Alternatif tanpa syarat follower: arahkan relay ke **Restream.io** (satu
> target `rtmp://live.restream.io/live/KEY`) dan atur tujuan IG/TikTok di sana.

### Verifikasi multistream
Log Railway akan menampilkan: `mulai → 3 target: rtmps://a.rtmps.youtube.com/****| ...`

## Catatan teknis

- Browser mengirim WebM (VP8/H.264 + Opus) potongan 1 detik; ffmpeg mentranscode
  ke **H.264 + AAC** (wajib untuk YouTube) → FLV → RTMPS port 443.
- Latensi total ±5–15 detik (normal untuk pipeline transcode).
- Railway free tier cukup untuk 1 siaran 720p; ffmpeg memakai ~0.5–1 vCPU.
