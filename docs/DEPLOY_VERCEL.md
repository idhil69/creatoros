# Deploy CreatorOS ke Vercel + Dapatkan APK

Total waktu: ± 15 menit. Urutannya wajib: **deploy dulu → baru buat APK**,
karena APK Android (TWA) terikat ke domain HTTPS produksi.

---

## Bagian 1 — Database gratis (Neon) · ±3 menit

Vercel tidak menyediakan PostgreSQL bawaan, jadi kita pakai Neon (gratis):

1. Buka **https://neon.tech** → daftar (bisa pakai akun GitHub).
2. **Create project** → beri nama `creatoros` → region **Singapore (ap-southeast-1)**.
3. Salin **Connection string** yang muncul, formatnya:
   ```
   postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Simpan — ini akan jadi `DATABASE_URL`.

## Bagian 2 — Push kode ke GitHub · ±3 menit

```bash
git init
git add .
git commit -m "CreatorOS v1.0.0-alpha"
# Buat repo kosong di github.com, lalu:
git remote add origin https://github.com/USERNAME/creatoros.git
git push -u origin main
```

## Bagian 3 — Deploy di Vercel · ±3 menit

1. Buka **https://vercel.com** → login dengan GitHub.
2. **Add New → Project** → pilih repo `creatoros` → framework terdeteksi otomatis (Next.js).
3. Di bagian **Environment Variables**, tambahkan:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | connection string Neon dari Bagian 1 |
   | `TOKEN_SECRET` | string acak panjang (mis. hasil `openssl rand -base64 32`) |
   | `APP_URL` | URL produksi kamu, mis. `https://creatoros.vercel.app` |

   Untuk **login dengan akun sosmed pribadimu** (YouTube/IG/FB/TikTok asli),
   tambahkan juga kredensial OAuth — lihat panduan lengkap **docs/OAUTH_SETUP.md**:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`,
   `FACEBOOK_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
4. Klik **Deploy**. Tunggu ± 2 menit → dapat URL, misal:
   ```
   https://creatoros.vercel.app
   ```

## Bagian 4 — Buat tabel database · ±1 menit

Dari komputer, jalankan sekali (ganti URL dengan milikmu):

```bash
npx drizzle-kit push \
  --dialect=postgresql \
  --schema=./src/db/schema.ts \
  --url="postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

Buka `https://creatoros.vercel.app` — aplikasi sudah jalan penuh. ✅

> **Mulai titik ini kamu SUDAH bisa pakai di HP**: buka URL di Chrome Android →
> menu ⋮ → **"Tambahkan ke layar utama"**. Layar penuh, ikon sendiri, offline cache.

---

## Bagian 5 — File APK via PWABuilder · ±5 menit (tanpa install tool apa pun)

1. Di HP/komputer, buka **https://www.pwabuilder.com**.
2. Masukkan URL produksi: `https://creatoros.vercel.app` → **Start**.
3. Setelah skor PWA muncul → **Package For Stores** → pilih **Android**.
4. Isi (atau biarkan default):
   - Package ID: `com.creatoros.app`
   - App name: `CreatorOS`
   - Version: `1.0.0`
5. Klik **Download** → dapat file `.zip` berisi:
   - **`CreatorOS-signed.apk`** ← ini file APK-nya
   - `assetlinks.json` (untuk langkah 7)
   - `.aab` (kalau nanti mau upload ke Play Store)

### 6. Install APK di HP
1. Kirim/salin `CreatorOS-signed.apk` ke HP (atau download langsung dari HP).
2. Ketuk file APK → jika diminta, izinkan **"Instal aplikasi tidak dikenal"** untuk browser/file manager.
3. Instal → selesai. 🎉

### 7. Hilangkan address bar (opsional tapi disarankan)
1. Buka file `assetlinks.json` dari zip PWABuilder, salin nilai `sha256_cert_fingerprints`.
2. Tempel ke `public/.well-known/assetlinks.json` di proyek (ganti teks placeholder).
3. `git commit` + `git push` → Vercel deploy ulang otomatis.
4. Buka ulang aplikasi APK → kini full-screen tanpa address bar.

---

## Ringkasan

| Langkah | Hasil |
|---|---|
| Neon + Vercel | Aplikasi live di `https://xxx.vercel.app` |
| drizzle-kit push | Tabel database dibuat |
| Chrome → Tambahkan ke layar utama | Terpasang di HP **detik itu juga** |
| PWABuilder | File `CreatorOS-signed.apk` |
| assetlinks.json | APK full-screen tanpa address bar |
