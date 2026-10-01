# Live Tanpa Batas Durasi — Rekomendasi & Setup

## Kenapa live kamu berhenti? (sumber batasan)

### A. Batasan infrastruktur gratisan (INI yang bisa dihilangkan)

| Layanan | Batasan | Akibat |
|---|---|---|
| Railway free (relay) | Kredit $5/bln — ffmpeg transcode boros CPU | Live mati setelah 1–2 jam / kredit habis |
| Render free | Service "tidur", CPU shared | Putus-putus, mati sendiri |
| Livepeer free | Kuota menit transcode/delivery | Berhenti saat kuota habis |
| **Browser HP** | Tab di-suspend saat layar mati / pindah aplikasi | **Live mati dalam hitungan menit** ← penyebab paling umum! |

### B. Batasan dari platform (TIDAK bisa dihilangkan oleh siapa pun)

| Platform | Batas resmi per siaran |
|---|---|
| YouTube | Praktis tak terbatas (arsip/DVR maks 12 jam) |
| Facebook | 8 jam |
| Instagram | 4 jam |
| TikTok | ±8 jam (kebijakan) |

> Restream berbayar pun tunduk pada batas platform ini. Targetkan realistis:
> siaran panjang = fokus YouTube; FB/IG ikut sampai batas mereka lalu putus sendiri
> (yang lain tetap jalan karena `onfail=ignore`).

---

## ✅ REKOMENDASI: setup tanpa batasan infrastruktur

```
📱 Larix Broadcaster ──RTMP──▶ 🖥 VPS Oryx/MediaMTX ──▶ YT + FB + IG + TikTok
   (jalan di background,          (24/7, tanpa kuota,
    bukan browser!)                tanpa tidur, -c copy)
```

**Komponen & biayanya:**

| Komponen | Biaya | Batas durasi |
|---|---|---|
| VPS 1vCPU/1GB (IDCloudHost/Vultr/DO) | ~Rp50–90rb/bln | **Tidak ada** — nyala 24/7 |
| Oryx atau MediaMTX (sudah di repo) | Gratis (MIT) | Tidak ada |
| Larix Broadcaster | Gratis | Tidak ada (selama HP kuat) |
| CreatorOS (chat & kontrol) | Sudah ada | Tidak ada |

**Hapus dari rutinitas:** siaran via browser/Livepeer/Railway — semua punya umur pendek.

### Hitungan bandwidth VPS (biar yakin)

Bitrate 2.5 Mbps × 4 platform keluar ≈ **±4,5 GB/jam**.
VPS umumnya beri kuota 1–2 TB/bln → **±220–440 jam siaran/bulan** — lebih dari cukup.
(Mau lebih hemat? 1.5 Mbps 720p → ±2,7 GB/jam.)

---

## Setup HP untuk siaran berjam-jam (WAJIB — penyebab #1 live pendek)

1. **Larix, bukan browser** — browser Android membunuh tab saat layar mati.
2. Android → **Settings → Apps → Larix → Battery → Unrestricted/No restrictions**
   (matikan battery optimization untuk Larix).
3. Larix → Settings → **Keep awake / Background streaming: ON**.
4. **HP dicolok charger** selama siaran (live 3 jam ≈ 40–60% baterai).
5. Hindari HP panas: lepas casing, jangan kena matahari; kalau perlu kamera belakang
   dimatikan previewnya di Larix (hemat ~20% baterai).
6. Jaringan: **Wi-Fi** jika ada; di 4G, set bitrate 1500–2000 kbps agar stabil.
7. Larix → Connection → mode **SRT** ke Oryx (port 10080) lebih tahan sinyal naik-turun
   daripada RTMP (opsional, Oryx sudah siap).

## Setup VPS untuk siaran panjang

- `restart: unless-stopped` sudah aktif di compose → MediaMTX/Oryx bangkit sendiri jika crash.
- Cek sebelum siaran penting: `docker logs --tail 20 creatoros-mediamtx` (atau UI Oryx).
- Reconnect otomatis: jika sinyal HP putus 10–30 detik, Larix menyambung ulang dan
  ffmpeg push lanjut — penonton hanya melihat buffering singkat.

## Catatan CreatorOS

- Broadcast YouTube dibuat dengan `enableAutoStop` — kalau encoder putus **lama**
  (>beberapa menit), YouTube menutup siaran. Untuk siaran maraton, pastikan
  jaringan HP stabil atau pakai SRT.
- Chat & statistik di CreatorOS tidak punya batas waktu — polling jalan selama
  halaman terbuka. Boleh ditutup dan dibuka lagi kapan pun tanpa mengganggu siaran
  (video jalan via Larix, bukan via halaman).
