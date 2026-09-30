# Login dengan Akun Sosmed Pribadi (OAuth Asli)

CreatorOS mendukung **dua mode sekaligus**:
- **Mock** (default): tanpa kredensial, data simulasi — untuk coba-coba.
- **Asli**: begitu environment variables di bawah diisi di Vercel, tombol
  "Hubungkan" untuk platform tersebut otomatis membuka halaman login resmi
  (Google/Meta/TikTok), dan profil aslimu (nama, username, jumlah
  subscriber/follower) tersimpan di aplikasi. Token dienkripsi AES-256-GCM.

> Ganti `creatoros.vercel.app` di bawah dengan domain Vercel kamu.

---

## Environment Variables (Vercel → Settings → Environment Variables)

| Variable | Untuk | Wajib |
|---|---|---|
| `DATABASE_URL` | PostgreSQL (Neon) | ✅ |
| `TOKEN_SECRET` | Kunci enkripsi token (string acak panjang) | ✅ disarankan |
| `APP_URL` | `https://creatoros.vercel.app` (tanpa slash akhir) | ✅ disarankan |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | YouTube | opsional |
| `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET` | Facebook & Instagram | opsional |
| `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` | TikTok | opsional |

Isi hanya platform yang kamu butuhkan — yang lain tetap jalan sebagai Mock.
Setelah menambah/mengubah env vars, lakukan **Redeploy** di Vercel.

---

## 1. YouTube (Google) — paling mudah, ±10 menit

1. Buka **https://console.cloud.google.com** → buat project baru `creatoros`.
2. **APIs & Services → Library** → cari **YouTube Data API v3** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → isi nama app & email → Save.
   - **Audience → Test users → Add users** → masukkan **email Google kamu sendiri**
     (wajib selama app berstatus Testing).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     https://creatoros.vercel.app/api/oauth/youtube/callback
     ```
5. Salin **Client ID** → `GOOGLE_CLIENT_ID`, **Client secret** → `GOOGLE_CLIENT_SECRET`.

Selesai. Buka aplikasi → Akun → Hubungkan → YouTube (badge **Asli**) → login Google → channel-mu muncul dengan jumlah subscriber asli.

## 2. Facebook & Instagram (Meta) — ±15 menit

1. Buka **https://developers.facebook.com** → **My Apps → Create App** →
   use case **Other** → type **Business**.
2. Di dashboard app: **Add Product → Facebook Login → Web**.
3. **Facebook Login → Settings → Valid OAuth Redirect URIs**:
   ```
   https://creatoros.vercel.app/api/oauth/facebook/callback
   https://creatoros.vercel.app/api/oauth/instagram/callback
   ```
4. **App Settings → Basic**: salin **App ID** → `FACEBOOK_APP_ID`,
   **App Secret** → `FACEBOOK_APP_SECRET`.
5. Selama app **Development mode**, hanya akun kamu (admin/tester) yang bisa login — cukup untuk pemakaian pribadi.

Catatan:
- **Facebook**: yang terhubung adalah **Halaman (Page)** pertamamu; tanpa Page, profil dasar yang dipakai (0 follower).
- **Instagram**: akun IG harus tipe **Professional (Business/Creator)** dan
  **tertaut ke sebuah Facebook Page** (atur di aplikasi IG → Settings →
  Business tools). Tanpa itu koneksi IG akan menampilkan pesan error yang menjelaskan.

## 3. TikTok — ±15 menit (perlu review singkat)

1. Buka **https://developers.tiktok.com** → **Manage apps → Connect an app**.
2. Tambahkan produk **Login Kit**, platform **Web**.
3. **Redirect URI**:
   ```
   https://creatoros.vercel.app/api/oauth/tiktok/callback
   ```
4. Scopes: `user.info.basic`, `user.info.profile`, `user.info.stats`.
5. Salin **Client key** → `TIKTOK_CLIENT_KEY`, **Client secret** → `TIKTOK_CLIENT_SECRET`.
6. Dalam **Sandbox mode**, tambahkan akun TikTok kamu sebagai **target user** agar bisa login tanpa menunggu app review.

---

## Alur teknis (sudah diimplementasikan)

```
[HP] ─ ketuk Hubungkan ─▶ GET /api/oauth/{platform}/start
        set cookie state+PKCE ─▶ redirect ke halaman login resmi provider
[User login & setuju]
provider ─▶ GET /api/oauth/{platform}/callback?code=...&state=...
        validasi state → tukar code+verifier → access token
        → ambil profil asli (nama, username, followers)
        → simpan akun, token AES-256-GCM terenkripsi
        → redirect /accounts?connected=NamaAkun 🎉
```

- Rahasia (client secret) hanya ada di server (env), tidak pernah ke browser/APK.
- Hubungkan ulang akun yang sama = update, tidak duplikat.
- Semua koneksi tercatat di **Setelan → Log audit**.

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `redirect_uri_mismatch` | Redirect URI di console provider tidak sama persis (perhatikan https & tanpa slash akhir) |
| Google: "app belum diverifikasi" | Tambahkan emailmu sebagai **Test user** di OAuth consent screen |
| Facebook: "URL tidak dapat dimuat" | Pastikan kedua callback (facebook & instagram) ada di Valid OAuth Redirect URIs |
| Instagram error akun tidak ditemukan | Ubah IG ke akun Professional + tautkan ke Facebook Page |
| TikTok: "client_key invalid" | App masih sandbox → tambahkan akunmu sebagai target user |
| Setelah isi env tidak berubah | Klik **Redeploy** di Vercel (env dibaca saat build/runtime baru) |
