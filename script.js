// ===== Google Form URL Configuration =====
// Ganti URL di bawah ini dengan link Google Form Anda
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform";

// ===== Registration Status =====
// Status diambil dari API, default true (terbuka) jika API belum ready
let registrationStatus = {
    isOpen: true,
    updatedAt: null,
};

const STATUS_ENDPOINT = "/api/status";

async function fetchStatus() {
    try {
        const res = await fetch(STATUS_ENDPOINT);
        if (!res.ok) throw new Error("Status fetch failed");
        const data = await res.json();
        registrationStatus = data;
    } catch (err) {
        console.warn("Gagal mengambil status, default terbuka:", err);
        // Fallback: tetap terbuka
    }
    applyStatusToUI();
}

function applyStatusToUI() {
    const ctaLink = document.getElementById("googleFormLink");
    const heroCta = document.getElementById("heroCta");
    const closedBanner = document.getElementById("closedBanner");
    const ctaSection = document.getElementById("ctaSection");

    if (!registrationStatus.isOpen) {
        // Tutup pendaftaran
        if (ctaLink) {
            ctaLink.classList.add("disabled");
            ctaLink.setAttribute("aria-disabled", "true");
            ctaLink.textContent = "PENDAFTARAN DITUTUP";
        }
        if (heroCta) {
            heroCta.classList.add("disabled");
            heroCta.setAttribute("aria-disabled", "true");
            heroCta.textContent = "PENDAFTARAN DITUTUP";
        }
        if (closedBanner) closedBanner.classList.remove("hidden");
        if (ctaSection) ctaSection.classList.add("dimmed");
        document.body.classList.add("registration-closed");
    } else {
        // Buka pendaftaran
        if (ctaLink) {
            if (GOOGLE_FORM_URL.includes("YOUR_FORM_ID") === false) {
                ctaLink.href = GOOGLE_FORM_URL;
                ctaLink.target = "_blank";
                ctaLink.rel = "noopener noreferrer";
            }
            ctaLink.classList.remove("disabled");
            ctaLink.textContent = "ISI FORMULIR PENDAFTARAN";
        }
        if (heroCta) {
            if (GOOGLE_FORM_URL.includes("YOUR_FORM_ID") === false) {
                heroCta.href = GOOGLE_FORM_URL;
                heroCta.target = "_blank";
                heroCta.rel = "noopener noreferrer";
            }
            heroCta.classList.remove("disabled");
            heroCta.textContent = "DAFTAR SEKARANG";
        }
        if (closedBanner) closedBanner.classList.add("hidden");
        if (ctaSection) ctaSection.classList.remove("dimmed");
        document.body.classList.remove("registration-closed");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchStatus();
    // Poll setiap 30 detik untuk update real-time
    setInterval(fetchStatus, 30000);
});
