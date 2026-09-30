# CreatorOS

**All-in-One Social Media Management Platform for Content Creators** — PWA fullstack (Next.js + PostgreSQL) yang bisa di-install di Android seperti APK.

## ✨ Fitur

- 🔗 **Akun Terhubung** — YouTube, Instagram, Facebook, TikTok (OAuth asli + mode mock)
- 📤 **Cross-Posting** — upload sekali, terbitkan ke banyak platform
- 📅 **Kalender Konten** — jadwalkan postingan
- 📊 **Analitik Terpadu** — metrik gabungan semua platform
- 🎥 **Live Center** — studio siaran multi-platform: preview kamera, chat terpadu, moderasi, gift/Super Chat, statistik & ringkasan pasca-live
- 🤖 **Asisten AI** — caption, judul, hashtag, ide konten
- 📱 **PWA** — install di HP, full-screen, offline cache; siap dibungkus jadi APK

## 🚀 Jalankan lokal

```bash
npm install
cp .env.example .env         # isi DATABASE_URL PostgreSQL kamu
npx drizzle-kit push         # buat tabel
npm run dev                  # http://localhost:3000
```

## ☁️ Deploy & APK

| Panduan | File |
|---|---|
| Deploy ke Vercel + Neon | [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) |
| Login dengan sosmed pribadi (OAuth asli) | [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md) |
| Membuat file APK Android | [docs/ANDROID_APK.md](docs/ANDROID_APK.md) |

## 🔒 Keamanan

- Client secret hanya di server (env vars) — tidak pernah ke browser/APK
- Token sosmed dienkripsi **AES-256-GCM** (`TOKEN_SECRET`)
- OAuth 2.0 + **PKCE** + validasi state
- Audit log semua koneksi akun

## 🗂️ Struktur

```
src/
├── app/            # Halaman (App Router) + API routes
│   ├── api/        # accounts, posts, analytics, ai, live, oauth, settings
│   ├── accounts/   # Akun terhubung
│   ├── content/    # Konten & cross-posting
│   ├── live/       # Live Center
│   └── ...
├── components/     # UI bersama (AppShell, ikon, dsb.)
├── db/             # Drizzle schema & koneksi
└── lib/            # OAuth, crypto, AI, platform meta
public/             # PWA: manifest icons, service worker, assetlinks
docs/               # Panduan deploy, OAuth, APK
```

**Stack:** Next.js 16 (App Router) · PostgreSQL + Drizzle ORM · Tailwind CSS v4 · PWA/TWA

---
Built with ❤️ for Content Creators · MIT License
