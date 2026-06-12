# TOYO ASSO Landing Page

Landing page rekrutmen **TOYO ASSO KABUSHIKI GAISHA (東洋圧送株式会社)** dengan admin panel untuk toggle buka/tutup pendaftaran.

🌐 **Live**: https://toyo-asso-landing.vercel.app
🔐 **Admin**: https://toyo-asso-landing.vercel.app/admin/

## Struktur File
```
.
├── index.html              # Halaman utama
├── style.css               # Styling landing page
├── script.js               # Status check + Google Form link
├── admin/
│   ├── index.html          # Halaman admin
│   ├── admin.css           # Styling admin
│   └── admin.js            # Logic login & toggle
├── api/
│   ├── status.js           # GET: status pendaftaran
│   └── toggle.js           # POST: toggle status (butuh password)
├── package.json            # @vercel/kv dependency
├── vercel.json             # Konfigurasi Vercel
└── README.md
```

## 🔐 Admin Panel
URL: `https://toyo-asso-landing.vercel.app/admin/`

**Password default**: `toyo2026admin` (ganti via Vercel env var `ADMIN_PASSWORD`)

### Fitur Admin
- 🟢 **BUKA** pendaftaran → CTA aktif, banner tertutup hilang
- 🔴 **TUTUP** pendaftaran → CTA disabled, banner merah muncul, hero jadi abu-abu
- Auto-refresh status setiap 30 detik di landing page

## 🛠️ Setup Awal (Wajib Setelah Deploy)

### 1. Setup Redis untuk Status Toggle
Vercel KV sudah deprecated. Gunakan **Upstash Redis** dari Vercel Marketplace:

1. Buka https://vercel.com/dashboard
2. Pilih project **toyo-asso-landing**
3. Tab **Storage** → klik **Create Database** → pilih **Upstash Redis**
4. Pilih region terdekat (Singapore/Jakarta untuk Indonesia)
5. Klik **Create** → **Connect to Project** → pilih project ini
6. Environment variables akan otomatis ter-set

Setelah Redis aktif, `note: "Default state (KV not configured")` di `/api/status` akan hilang.

### 2. Ganti Admin Password (Sangat Disarankan)
```bash
vercel env rm ADMIN_PASSWORD production
vercel env add ADMIN_PASSWORD production
# Masukkan password baru Anda
```

Atau via Dashboard: Project → Settings → Environment Variables.

### 3. Set Google Form URL
Edit [script.js](script.js) baris 3, ganti `YOUR_FORM_ID` dengan ID Google Form:
```js
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform";
```
Commit & push — Vercel akan auto-deploy.

## 🔄 Workflow Update
Karena GitHub repo sudah terhubung ke Vercel, setiap push ke `main` akan auto-deploy:

```bash
git add .
git commit -m "Update sesuatu"
git push origin main
```

Tunggu ~30 detik, perubahan akan live.

## 📝 Catatan Teknis
- **Default state**: Jika Redis belum di-setup, status selalu `isOpen: true` (pendaftaran terbuka). Aman untuk first deploy.
- **Status polling**: Landing page cek status setiap 30 detik (ringan, ~200 bytes per request).
- **Password storage**: Disimpan di `sessionStorage` browser admin (hilang saat tab ditutup).
- **Tidak ada auth untuk admin endpoint** selain password — pastikan URL `/admin/` tidak di-share publik.

## 🆘 Troubleshooting
- **Toggle tidak bekerja**: Cek apakah Redis sudah di-connect. Cek log: `vercel logs`
- **Status API return error**: `vercel env ls` — pastikan `KV_*` env vars ada (otomatis dari Upstash)
- **Admin lupa password**: Re-set via `vercel env add ADMIN_PASSWORD production`
