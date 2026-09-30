# Membuat APK Android dari CreatorOS

CreatorOS dibangun sebagai **Progressive Web App (PWA)** fullstack (Next.js + PostgreSQL).
Ada dua cara menjalankannya sebagai aplikasi Android:

## Cara 1 — Instal langsung (tanpa build)

1. Deploy aplikasi ke domain HTTPS (mis. Vercel, Railway, VPS).
2. Buka URL di Chrome Android.
3. Buka **Setelan → "Instal aplikasi"** di dalam CreatorOS, atau menu Chrome (⋮) → **Tambahkan ke layar utama**.
4. Aplikasi berjalan layar penuh (standalone) dengan ikon di home screen, splash screen, dan cache offline.

## Cara 2 — Build file `.apk` / `.aab` (Trusted Web Activity)

Membutuhkan Node.js 18+, JDK 17, dan Android SDK (Bubblewrap dapat mengunduhnya otomatis).

```bash
# 1. Install Bubblewrap CLI
npm i -g @bubblewrap/cli

# 2. Ganti YOUR-DOMAIN.example.com di twa-manifest.json dengan domain produksi kamu

# 3. Inisialisasi proyek Android dari manifest PWA
bubblewrap init --manifest https://YOUR-DOMAIN.example.com/manifest.webmanifest

# 4. Build APK & AAB (akan membuat keystore jika belum ada)
bubblewrap build
#  → app-release-signed.apk  (instal langsung ke HP)
#  → app-release-bundle.aab  (upload ke Google Play)

# 5. Instal ke perangkat via USB debugging
bubblewrap install
```

### Digital Asset Links (menghilangkan address bar)

Setelah `bubblewrap build`, ambil SHA-256 fingerprint:

```bash
keytool -list -v -keystore android.keystore -alias creatoros | grep SHA256
```

Lalu isi `public/.well-known/assetlinks.json` dengan fingerprint tersebut dan deploy ulang.

## Struktur teknis

| Komponen | Implementasi |
|----------|--------------|
| UI mobile-first | Next.js App Router, Tailwind v4, Material-style bottom nav |
| Design system | primary `#b45309`, secondary `#fbbf24`, accent `#ea580c`, surface `#fffbeb`, IBM Plex Sans, tombol pill 999px, kartu 12px |
| Backend | Next.js Route Handlers (`/api/*`) + Drizzle ORM + PostgreSQL |
| Mock OAuth | `POST /api/accounts` — simulasi OAuth 2.0 + PKCE dengan delay & data deterministik |
| PWA | `src/app/manifest.ts`, `public/sw.js` (app-shell cache, network-first untuk API) |
| APK | `twa-manifest.json` (Bubblewrap / Trusted Web Activity) |
