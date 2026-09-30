# Live Streaming ASLI

CreatorOS punya **dua jalur siaran riil** yang bisa dipakai sendiri-sendiri atau bersamaan:

| Jalur | Cara kerja | Butuh |
|---|---|---|
| **A. Livepeer WHIP** | Kamera HP → WebRTC langsung dari browser (tanpa OBS/encoder) | Stream key dari livepeer.studio (gratis) |
| **B. YouTube Live API** | Broadcast asli dibuat di channel-mu + chat/penonton asli | Akun YouTube asli terhubung + encoder (Larix/OBS) |

**Kombinasi terbaik:** isi Livepeer key + pilih YouTube LIVE ASLI → kamera HP streaming ke Livepeer,
lalu atur **Multistream** di dashboard Livepeer ke RTMP YouTube (Server + Key dari panel merah CreatorOS).
Hasil: siaran dari HP tanpa OBS, dengan chat & penonton YouTube asli di CreatorOS.

## Jalur A — Livepeer (dari browser, tanpa encoder)

1. Daftar gratis di **livepeer.studio** → Create stream → salin **Stream key**.
2. Live Center → tempel key di kolom **Livepeer Stream Key** (tersimpan di HP).
3. Mulai Live → banner hijau "✅ Terhubung ke Livepeer" = kamera HP sedang siaran riil.
4. (Opsional) Di livepeer.studio → stream kamu → **Multistream targets** → tambahkan
   RTMP YouTube/Twitch/dll agar diteruskan ke platform tujuan.

# Jalur B — YouTube Live API

CreatorOS kini membuat **broadcast YouTube sungguhan** via YouTube Live API:
chat penonton asli, jumlah penonton asli, balasan host terkirim ke chat YouTube,
dan siaran berakhir sungguhan di channel kamu.

## Prasyarat (sekali saja)

1. **Live streaming aktif di channel kamu**
   YouTube Studio → Buat → Live → verifikasi nomor HP → tunggu ±24 jam (aturan YouTube).
2. **Hubungkan ulang akun YouTube di CreatorOS**
   Scope baru (`youtube.force-ssl`) dibutuhkan untuk membuat broadcast & kirim chat.
   Buka **Akun → (akun YouTube) → Putuskan**, lalu **Hubungkan** lagi.
3. Env Vercel tetap sama (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `TOKEN_SECRET`).

## Cara siaran

1. **Live Center** → isi judul → pilih **YouTube (🔴 LIVE ASLI)** → Mulai Live.
   CreatorOS membuat broadcast + stream RTMP asli di channel kamu (auto-start & auto-stop aktif).
2. Panel merah muncul berisi **Server RTMP** + **Stream key**. Salin keduanya ke aplikasi encoder:
   - **Android**: Larix Broadcaster (gratis) / PRISM Live Studio
   - **PC**: OBS Studio (Settings → Stream → Custom)
3. Mulai streaming di encoder → dalam ±10–30 detik siaran **on-air otomatis** di YouTube.
4. Kelola dari CreatorOS: chat penonton asli masuk ke tab Chat (Super Chat tampil sebagai gift 💛),
   balasanmu terkirim ke chat YouTube sungguhan, tab Statistik menampilkan penonton bersamaan asli.
5. **Akhiri siaran** → broadcast YouTube ditutup (transition `complete`).

## Perilaku hybrid

| Platform | Mode |
|---|---|
| YouTube (akun asli terhubung) | 🔴 **LIVE ASLI** — API sungguhan |
| YouTube (akun mock) | Simulasi |
| Instagram / Facebook / TikTok | Simulasi (API live pihak ketiga dibatasi platform¹) |

¹ TikTok Live API tertutup (butuh persetujuan khusus); Facebook Live butuh app review
untuk `publish_video`. Arsitektur sudah siap jika kelak ingin ditambahkan.

## Troubleshooting

| Pesan | Solusi |
|---|---|
| "Live streaming belum aktif di channel" | Aktifkan di YouTube Studio, tunggu 24 jam |
| "Izin kurang… hubungkan ulang" | Putuskan akun YouTube → Hubungkan lagi (scope baru) |
| Siaran tak kunjung on-air | Pastikan encoder benar-benar streaming ke Server+Key yang disalin |
| Chat tidak muncul | Chat asli ditarik tiap ±5 detik; pastikan siaran sudah on-air |
