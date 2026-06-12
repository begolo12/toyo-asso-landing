// ===== Admin Panel Logic =====
const API_BASE = ""; // Sama origin, gunakan path relatif
const STATUS_ENDPOINT = `${API_BASE}/api/status`;
const TOGGLE_ENDPOINT = `${API_BASE}/api/toggle`;

let adminPassword = null;

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginError = document.getElementById("loginError");
    const passwordInput = document.getElementById("passwordInput");
    const openBtn = document.getElementById("openBtn");
    const closeBtn = document.getElementById("closeBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const actionMsg = document.getElementById("actionMsg");

    // Login
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const password = passwordInput.value.trim();
        if (!password) return;

        loginError.textContent = "";
        passwordInput.disabled = true;
        const submitBtn = loginForm.querySelector("button");
        submitBtn.disabled = true;
        submitBtn.textContent = "Memverifikasi...";

        try {
            // Test password dengan toggle request dummy (tidak akan mengubah)
            // Lebih baik: kita gunakan cara GET status untuk verifikasi cepat
            // Tapi karena tidak ada endpoint verify, kita simpan password di memory
            // dan coba toggle nanti — jika gagal, password salah

            // Simpan password di sessionStorage (aman, hanya untuk session ini)
            sessionStorage.setItem("admin_pw", password);
            adminPassword = password;

            // Coba fetch status dulu untuk konfirmasi password via toggle test
            // Approach: langsung tampilkan panel, password akan divalidasi saat toggle pertama
            showControlPanel();
            await refreshStatus();
        } catch (err) {
            loginError.textContent = "Terjadi kesalahan. Coba lagi.";
            passwordInput.disabled = false;
            submitBtn.disabled = false;
            submitBtn.textContent = "Masuk";
        }
    });

    // Open
    openBtn.addEventListener("click", () => updateStatus(true, openBtn, actionMsg));

    // Close
    closeBtn.addEventListener("click", () => updateStatus(false, closeBtn, actionMsg));

    // Logout
    logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("admin_pw");
        adminPassword = null;
        document.getElementById("loginSection").classList.remove("hidden");
        document.getElementById("controlSection").classList.add("hidden");
        passwordInput.value = "";
    });

    // Auto-login jika ada session
    const savedPw = sessionStorage.getItem("admin_pw");
    if (savedPw) {
        adminPassword = savedPw;
        showControlPanel();
        refreshStatus();
    }
});

function showControlPanel() {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("controlSection").classList.remove("hidden");
}

async function refreshStatus() {
    const badge = document.getElementById("statusBadge");
    const updatedEl = document.getElementById("statusUpdated");
    const openBtn = document.getElementById("openBtn");
    const closeBtn = document.getElementById("closeBtn");

    try {
        const res = await fetch(STATUS_ENDPOINT);
        const data = await res.json();

        if (data.isOpen) {
            badge.textContent = "DIBUKA";
            badge.className = "status-badge open";
            openBtn.disabled = true;
            closeBtn.disabled = false;
        } else {
            badge.textContent = "DITUTUP";
            badge.className = "status-badge closed";
            openBtn.disabled = false;
            closeBtn.disabled = true;
        }

        if (data.updatedAt) {
            const dt = new Date(data.updatedAt);
            updatedEl.textContent = `Update terakhir: ${dt.toLocaleString("id-ID")}`;
        }
    } catch (err) {
        badge.textContent = "ERROR";
        badge.className = "status-badge closed";
        updatedEl.textContent = "Tidak dapat terhubung ke server";
    }
}

async function updateStatus(isOpen, btn, msgEl) {
    if (!adminPassword) {
        msgEl.textContent = "Password tidak ditemukan. Silakan login ulang.";
        msgEl.className = "action-msg error";
        return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Memproses...";
    msgEl.textContent = "";
    msgEl.className = "action-msg";

    try {
        const res = await fetch(TOGGLE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: adminPassword, isOpen }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
            msgEl.textContent = isOpen
                ? "✓ Pendaftaran berhasil DIBUKA"
                : "✓ Pendaftaran berhasil DITUTUP";
            msgEl.className = "action-msg success";
            await refreshStatus();
        } else if (res.status === 401) {
            msgEl.textContent = "✕ Password salah. Silakan login ulang.";
            msgEl.className = "action-msg error";
            sessionStorage.removeItem("admin_pw");
            setTimeout(() => location.reload(), 1500);
        } else {
            msgEl.textContent = `✕ Gagal: ${data.error || "Unknown error"}`;
            msgEl.className = "action-msg error";
        }
    } catch (err) {
        msgEl.textContent = "✕ Tidak dapat terhubung ke server.";
        msgEl.className = "action-msg error";
    } finally {
        btn.textContent = originalText;
        // refreshStatus akan set disabled state yang benar
    }
}
