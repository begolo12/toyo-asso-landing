# LPK PJB Landing Page

Landing page rekrutmen **LPK PJB (LPK - Putra Jabung Berkarya)** dengan admin panel untuk toggle buka/tutup pendaftaran, tambah lowongan baru, dan kelola data pendaftar.

🌐 **Live**: https://toyo-asso-landing.vercel.app
🔐 **Admin**: https://toyo-asso-landing.vercel.app/admin/

## Struktur File
```
.
├── index.html              # Halaman utama
├── style.css               # Styling landing page
├── script.js               # Jobs, modal detail, modal daftar, submit
├── admin/
│   ├── index.html          # Halaman admin
│   ├── admin.css           # Styling admin
│   └── admin.js            # Login, jobs, registrations, Tambah Lowongan
├── api/
│   ├── _db.js              # Shared Neon connection + schema bootstrap
│   ├── jobs.js             # GET: list lowongan (json + Neon)
│   ├── register.js         # POST: simpan pendaftar (Neon)
│   └── admin.js            # GET/POST: toggle, setStatus, createJob (Neon)
├── data/
│   └── jobs.json           # Seed lowongan statis (5 lowongan)
├── schema.sql              # SQL schema Neon (untuk setup manual)
├── package.json            # @neondatabase/serverless
├── vercel.json             # Konfigurasi Vercel
└── README.md
```

## 🗄️ Database: Neon Postgres

Project ini memakai **Neon Postgres** (via `@neondatabase/serverless`). Schema di-bootstrap otomatis oleh `api/_db.js` (`CREATE TABLE IF NOT EXISTS`), jadi tidak perlu jalankan SQL manual.

### Tabel
- `job_status` — status buka/tutup per lowongan
- `jobs` — lowongan dinamis (dibuat via admin)
- `registrations` — data pendaftar

### Setup di Vercel
1. Buka https://vercel.com/dashboard → pilih project ini
2. Tab **Storage** → **Create Database** → **Neon** → **Connect to Project**
3. `DATABASE_URL` akan otomatis tersedia sebagai env var
4. Deploy → schema otomatis dibuat

Untuk kontrol manual, lihat `schema.sql` (paste di Neon SQL Editor).

## 🖥️ Jalanin di Local (Tanpa Login Vercel)

Paling cepat untuk preview halaman + test UI:

```bash
npm run dev:local
# atau: node local-server.js
```

Buka http://localhost:3000

**Yang jalan di local:**
- ✅ Landing page + 5 job cards (termasuk TORIZEN) + tombol Detail
- ✅ Halaman admin `/admin/` (login dengan password `123`)
- ✅ Modal Detail (persyaratan, catatan mensetsu)
- ✅ Modal Pendaftaran (mock — return success, data TIDAK tersimpan permanen)
- ✅ Toggle buka/tutup lowongan (in-memory)
- ✅ Form Tambah Lowongan (simpan ke `data/jobs.json`)

**Cara stop:** `Ctrl+C` di terminal.

## 🔐 Admin Panel

URL: `/admin/`
**Password default**: `123` (ganti via Vercel env var `ADMIN_PASSWORD`)

### Fitur Admin
- 🟢 **BUKA/TUTUP** pendaftaran per lowongan
- ➕ **Tambah Lowongan** baru via form modal
- 📋 **Data Pendaftar** — tabel dengan filter + status (Pending/Lolos/Tidak Lolos)
- 📤 **Export** CSV / Excel / PDF

Data pendaftar hanya tersimpan: **Nama** + **No. HP** (email sudah dihapus).

## 🛠️ Workflow Update

Karena GitHub repo sudah terhubung ke Vercel, setiap push ke `main` akan auto-deploy:

```bash
git add .
git commit -m "Update sesuatu"
git push origin main
```

Tunggu ~30 detik, perubahan akan live.

## 📝 Catatan Teknis
- **Default state**: Jika Neon belum di-setup, lowongan dari `data/jobs.json` tetap tampil dengan status "dibuka" (aman untuk first deploy).
- **Jobs dinamis**: Lowongan yang dibuat via admin disimpan di tabel `jobs` (Neon), bukan di `jobs.json`. `data/jobs.json` hanya seed awal.
- **Tidak ada auth untuk admin endpoint** selain password — pastikan URL `/admin/` tidak di-share publik.

## 🆘 Troubleshooting
- **API error 500**: Cek `DATABASE_URL` sudah di-set di Vercel env vars
- **Toggle tidak bekerja**: Cek koneksi Neon, lihat `vercel logs`
- **Admin lupa password**: Re-set via `vercel env add ADMIN_PASSWORD production`
