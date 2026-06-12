# TOYO ASSO Landing Page

Static landing page untuk rekrutmen TOYO ASSO KABUSHIKI GAISHA (東洋圧送株式会社).

## Struktur File
```
.
├── index.html      # Halaman utama
├── style.css       # Styling
├── script.js       # Konfigurasi Google Form URL
├── vercel.json     # Konfigurasi Vercel
└── README.md       # File ini
```

## Cara Integrasi Google Form
Edit [script.js](script.js) baris ke-3:
```js
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform";
```
Ganti `YOUR_FORM_ID` dengan ID Google Form Anda.

## Deploy ke Vercel

### Cara 1: Via Vercel Dashboard (Paling Mudah)
1. Push folder ini ke GitHub repository
2. Buka [vercel.com](https://vercel.com) → Sign in
3. Klik **"Add New Project"**
4. Pilih repository GitHub Anda
5. Klik **"Deploy"** — selesai, dapat URL otomatis

### Cara 2: Via Vercel CLI
```bash
npm i -g vercel
vercel login
cd LANDING-PAGE
vercel
```

### Cara 3: Drag & Drop
1. Buka [vercel.com/new](https://vercel.com/new)
2. Drag folder `LANDING-PAGE` ke area upload
3. Klik **"Deploy"**

## Catatan
- File `index.html` harus ada di root (sudah benar)
- Tidak perlu build command, Vercel serve sebagai static site
- `vercel.json` opsional — menambah security headers & cache untuk CSS/JS
