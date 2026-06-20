// ============================================
// LPK PJB i18n — English / Indonesian toggle
// ============================================
// Default: Indonesian (matches the rest of the
// app's voice). Persisted to localStorage so
// returning visitors keep their preference.
// ============================================

const STORAGE_KEY = "lpkpjb.lang";
const DEFAULT_LANG = "id";

const subscribers = new Set();

// ---------------------------------------------------------------
// Dictionary — every key the UI needs.
// Add new keys here when introducing new translatable strings.
// Keep flat: nested objects (job.*, form.*) only for clarity.
// ---------------------------------------------------------------
const STRINGS = {
  id: {
    "brand.tagline": "Bekal Skill Kerja ke Jepang",
    "brand.aria": "LPK PJB — Beranda",

    "hero.eyebrow": "Resmi & Terpercaya",
    "hero.title": "Lowongan Kerja ke Jepang",
    "hero.subtitle": "Bekal Skill Kerja ke Jepang",
    "hero.description": "Pilih lowongan yang sesuai dengan keahlian Anda. Proses seleksi terbuka dan transparan — tanpa biaya pendaftaran.",
    "hero.cta": "LIHAT LOWONGAN",
    "hero.stat.jobs": "LOWONGAN AKTIF",
    "hero.stat.free": "GRATIS PENDAFTARAN",
    "hero.stat.response": "RESPON TIM LPK",
    "hero.stat.response.value": "1-3 Hari",

    "section.jobs.title": "Lowongan Tersedia",
    "section.jobs.count.open": "{open} dari {total} lowongan sedang dibuka",
    "section.jobs.count.empty": "0 lowongan tersedia",
    "section.jobs.filter.aria": "Filter lowongan berdasarkan gender",
    "section.jobs.filter.all": "Semua",
    "section.jobs.filter.male": "Pria",
    "section.jobs.filter.female": "Wanita",

    "job.gender.male": "Pria",
    "job.gender.female": "Wanita",
    "job.gender.all": "Pria & Wanita",
    "job.location": "Lokasi",
    "job.looking": "Dicari",
    "job.candidates": "kandidat",
    "job.salary.gross": "Gaji Kotor",
    "job.salary.net": "Gaji Bersih",
    "job.salary.unit": "/bln",
    "job.slot": "Slot tersisa {available} dari {slots}",
    "job.slot.full": "Slot penuh",
    "job.interview.offline": "Interview Offline",
    "job.interview.online": "Interview Online",
    "job.interview.tba": "Interview belum dijadwalkan",
    "job.interview.date": "{date}",
    "job.status.open": "DIBUKA",
    "job.status.full": "PENUH",
    "job.status.closed": "DITUTUP",
    "job.btn.detail": "Lihat detail {company}",
    "job.btn.detail.aria": "Lihat detail {company}",
    "job.btn.register": "DAFTAR",
    "job.btn.full": "PENUH",
    "job.btn.closed": "DITUTUP",
    "job.btn.closed.aria": "Pendaftaran ditutup",

    "why.title": "Mengapa LPK PJB?",
    "why.legal.title": "Resmi & Legal",
    "why.legal.body": "Terdaftar resmi sebagai Lembaga Pelatihan Kerja dengan izin operasional yang sah.",
    "why.partners.title": "Mitra Terpercaya",
    "why.partners.body": "Bekerjasama dengan perusahaan penerima di Jepang yang sudah terverifikasi.",
    "why.language.title": "Pelatihan Bahasa",
    "why.language.body": "Program intensif bahasa Jepang N4 untuk mempersiapkan Anda sebelum terbang.",
    "why.placement.title": "Penempatan Kerja",
    "why.placement.body": "Pendampingan dari seleksi hingga placement, termasuk dokumen dan MCU.",

    "footer.brand": "LPK PJB",
    "footer.fullname": "LPK - Putra Jabung Berkarya",
    "footer.copy": "© {year} LPK PJB. Hak cipta dilindungi.",
    "footer.admin": "Panel Admin",
    "footer.admin.aria": "Masuk ke panel admin",

    "error.title": "Gagal Memuat Lowongan",
    "error.body": "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
    "error.retry": "Coba Lagi",

    "modal.detail.industry": "Bidang",
    "modal.detail.location": "Lokasi",
    "modal.detail.interview": "Interview",
    "modal.detail.salary": "Gaji Kotor / Bersih",
    "modal.detail.requirements": "Persyaratan",
    "modal.detail.notes": "Catatan",
    "modal.detail.close": "Tutup",
    "modal.detail.register": "Daftar Sekarang",

    "modal.register.title": "Form Pendaftaran",
    "modal.register.job.label": "Lowongan yang dipilih",
    "modal.register.name": "Nama Lengkap",
    "modal.register.name.placeholder": "Sesuai KTP / paspor",
    "modal.register.birthPlace": "Tempat Lahir",
    "modal.register.birthDate": "Tanggal Lahir",
    "modal.register.gender": "Jenis Kelamin",
    "modal.register.gender.male": "Laki-laki",
    "modal.register.gender.female": "Perempuan",
    "modal.register.phone": "Nomor WhatsApp",
    "modal.register.phone.help": "Format Indonesia, mis. 081234567890",
    "modal.register.address": "Alamat Lengkap",
    "modal.register.notes": "Catatan (opsional)",
    "modal.register.submit": "Kirim Pendaftaran",
    "modal.register.submitting": "Mengirim...",
    "modal.register.success": "Pendaftaran berhasil! Tim kami akan menghubungi Anda 1-3 hari kerja.",
    "modal.register.error.network": "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
    "modal.register.error.generic": "Pendaftaran gagal. Silakan coba lagi.",
    "modal.register.cancel": "Batal",

    "form.error.name.short": "Nama lengkap minimal 2 karakter.",
    "form.error.phone.invalid": "Nomor handphone tidak valid (min. 8 digit).",
    "toast.registration.closed": "Pendaftaran untuk lowongan ini sudah ditutup.",
    "toast.registration.success": "Pendaftaran berhasil dikirim.",

    "modal.detail.description": "Deskripsi Pekerjaan",

    "lang.toggle.aria": "Ganti bahasa",
    "lang.label.id": "ID",
    "lang.label.en": "EN",
    "lang.active": "Aktif: {lang}",

    "loading.jobs": "Memuat lowongan...",

    "admin.nav.landing": "← Ke Landing Page",
    "admin.nav.logout": "Keluar",
    "admin.tabs.jobs": "Kelola Lowongan",
    "admin.tabs.registrations": "Data Pendaftar",
    "admin.tabs.history": "Riwayat Hide",
    "admin.login.title": "Admin Panel",
    "admin.login.subtitle": "Kontrol Pendaftaran Lowongan",
    "admin.login.password.label": "Password Admin",
    "admin.login.password.placeholder": "Masukkan password",
    "admin.login.submit": "Masuk",
    "admin.login.brand": "LPK PJB",
    "admin.login.fullname": "LPK - Putra Jabung Berkarya",

    "a11y.skip": "Lewati ke konten utama",
    "hero.stats.aria": "Statistik singkat",

    "modal.register.success.title": "Pendaftaran Berhasil!",
    "modal.register.success.body": "Terima kasih telah mendaftar. Tim LPK PJB akan menghubungi Anda dalam 1-3 hari kerja melalui WhatsApp.",
  },

  en: {
    "brand.tagline": "Skills for Working in Japan",
    "brand.aria": "LPK PJB — Home",

    "hero.eyebrow": "Official & Trusted",
    "hero.title": "Japan Job Opportunities",
    "hero.subtitle": "Skills for Working in Japan",
    "hero.description": "Pick a vacancy that matches your skills. The selection process is open and transparent — no registration fees.",
    "hero.cta": "VIEW JOBS",
    "hero.stat.jobs": "ACTIVE JOBS",
    "hero.stat.free": "FREE REGISTRATION",
    "hero.stat.response": "LPK TEAM RESPONSE",
    "hero.stat.response.value": "1-3 Days",

    "section.jobs.title": "Available Vacancies",
    "section.jobs.count.open": "{open} of {total} vacancies currently open",
    "section.jobs.count.empty": "0 vacancies available",
    "section.jobs.filter.aria": "Filter vacancies by gender",
    "section.jobs.filter.all": "All",
    "section.jobs.filter.male": "Male",
    "section.jobs.filter.female": "Female",

    "job.gender.male": "Male",
    "job.gender.female": "Female",
    "job.gender.all": "Male & Female",
    "job.location": "Location",
    "job.looking": "Hiring",
    "job.candidates": "candidates",
    "job.salary.gross": "Gross Salary",
    "job.salary.net": "Net Salary",
    "job.salary.unit": "/mo",
    "job.slot": "{available} of {slots} slots remaining",
    "job.slot.full": "All slots filled",
    "job.interview.offline": "Offline Interview",
    "job.interview.online": "Online Interview",
    "job.interview.tba": "Interview not yet scheduled",
    "job.interview.date": "{date}",
    "job.status.open": "OPEN",
    "job.status.full": "FULL",
    "job.status.closed": "CLOSED",
    "job.btn.detail": "View detail {company}",
    "job.btn.detail.aria": "View detail {company}",
    "job.btn.register": "APPLY",
    "job.btn.full": "FULL",
    "job.btn.closed": "CLOSED",
    "job.btn.closed.aria": "Registration closed",

    "why.title": "Why LPK PJB?",
    "why.legal.title": "Official & Legal",
    "why.legal.body": "Officially registered as a Job Training Institute with valid operational permits.",
    "why.partners.title": "Trusted Partners",
    "why.partners.body": "Working with verified Japanese companies that hire our graduates.",
    "why.language.title": "Language Training",
    "why.language.body": "Intensive Japanese N4 program to prepare you before flying out.",
    "why.placement.title": "Job Placement",
    "why.placement.body": "End-to-end support from selection to placement, including documents and medical check-up.",

    "footer.brand": "LPK PJB",
    "footer.fullname": "LPK - Putra Jabung Berkarya",
    "footer.copy": "© {year} LPK PJB. All rights reserved.",
    "footer.admin": "Admin Panel",
    "footer.admin.aria": "Sign in to admin panel",

    "error.title": "Failed to Load Vacancies",
    "error.body": "Unable to connect to the server. Please check your internet connection.",
    "error.retry": "Try Again",

    "modal.detail.industry": "Industry",
    "modal.detail.location": "Location",
    "modal.detail.interview": "Interview",
    "modal.detail.salary": "Gross / Net Salary",
    "modal.detail.requirements": "Requirements",
    "modal.detail.notes": "Notes",
    "modal.detail.close": "Close",
    "modal.detail.register": "Apply Now",

    "modal.register.title": "Registration Form",
    "modal.register.job.label": "Selected vacancy",
    "modal.register.name": "Full Name",
    "modal.register.name.placeholder": "As shown on your ID / passport",
    "modal.register.birthPlace": "Place of Birth",
    "modal.register.birthDate": "Date of Birth",
    "modal.register.gender": "Gender",
    "modal.register.gender.male": "Male",
    "modal.register.gender.female": "Female",
    "modal.register.phone": "WhatsApp Number",
    "modal.register.phone.help": "Indonesian format, e.g. 081234567890",
    "modal.register.address": "Full Address",
    "modal.register.notes": "Notes (optional)",
    "modal.register.submit": "Submit Registration",
    "modal.register.submitting": "Submitting...",
    "modal.register.success": "Registration successful! Our team will contact you within 1-3 business days.",
    "modal.register.error.network": "Unable to connect to the server. Please check your internet connection.",
    "modal.register.error.generic": "Registration failed. Please try again.",
    "modal.register.cancel": "Cancel",

    "form.error.name.short": "Full name must be at least 2 characters.",
    "form.error.phone.invalid": "Invalid phone number (min. 8 digits).",
    "toast.registration.closed": "Registration for this vacancy is closed.",
    "toast.registration.success": "Registration submitted successfully.",

    "modal.detail.description": "Job Description",

    "lang.toggle.aria": "Switch language",
    "lang.label.id": "ID",
    "lang.label.en": "EN",
    "lang.active": "Active: {lang}",

    "loading.jobs": "Loading vacancies...",

    "admin.nav.landing": "← Back to Landing Page",
    "admin.nav.logout": "Logout",
    "admin.tabs.jobs": "Manage Jobs",
    "admin.tabs.registrations": "Registrations",
    "admin.tabs.history": "Hide History",
    "admin.login.title": "Admin Panel",
    "admin.login.subtitle": "Vacancy Registration Control",
    "admin.login.password.label": "Admin Password",
    "admin.login.password.placeholder": "Enter password",
    "admin.login.submit": "Sign in",
    "admin.login.brand": "LPK PJB",
    "admin.login.fullname": "LPK - Putra Jabung Berkarya",

    "a11y.skip": "Skip to main content",
    "hero.stats.aria": "Quick stats",

    "modal.register.success.title": "Registration Successful!",
    "modal.register.success.body": "Thank you for registering. The LPK PJB team will contact you within 1-3 business days via WhatsApp.",
  },
};

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let currentLang = readStoredLang();

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "id" || stored === "en") return stored;
  } catch {
    /* localStorage may be blocked; fall through */
  }
  return DEFAULT_LANG;
}

function persistLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------
export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== "id" && lang !== "en") return;
  if (lang === currentLang) return;
  currentLang = lang;
  persistLang(lang);
  document.documentElement.lang = lang === "id" ? "id" : "en";
  for (const fn of subscribers) {
    try { fn(lang); } catch (err) { console.error("i18n subscriber error:", err); }
  }
}

export function toggleLang() {
  setLang(currentLang === "id" ? "en" : "id");
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// ---------------------------------------------------------------
// Translation
// ---------------------------------------------------------------
export function t(key, params) {
  const dict = STRINGS[currentLang] || STRINGS[DEFAULT_LANG];
  let str = dict[key];
  if (str == null) {
    // Fallback to other lang if key missing in current lang
    const other = currentLang === "id" ? "en" : "id";
    str = (STRINGS[other] || {})[key];
  }
  if (str == null) {
    if (typeof console !== "undefined") console.warn(`i18n missing key: ${key}`);
    return key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

// ---------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------

/** Apply translations to all [data-i18n] / [data-i18n-aria] elements inside root. */
export function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr") || "textContent";
    const value = t(key);
    if (attr === "textContent") {
      el.textContent = value;
    } else if (attr === "placeholder") {
      el.setAttribute("placeholder", value);
    } else {
      el.setAttribute(attr, value);
    }
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    el.setAttribute("aria-label", t(key));
  });
}

/** Init: set <html lang> and apply translations on load. */
export function initI18n(root = document) {
  document.documentElement.lang = currentLang === "id" ? "id" : "en";
  applyTranslations(root);
}
