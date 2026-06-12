// ===== Configuration =====
const JOBS_API = "/api/jobs";
const STATUS_API = "/api/status";
const REGISTER_API = "/api/register";

// Format Rupiah-style number untuk yen
const formatYen = (n) => "¥" + n.toLocaleString("id-ID");

// Format tanggal Indonesia
const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};

// State
let jobs = [];
let openStatus = {}; // jobId -> boolean
let currentFilter = "all"; // all | male | female

// ===== Load Jobs =====
async function loadJobs() {
    const container = document.getElementById("jobsContainer");
    const countEl = document.getElementById("jobsCount");

    try {
        const res = await fetch(JOBS_API);
        if (!res.ok) throw new Error("Failed to load jobs");
        const data = await res.json();

        jobs = data.jobs || [];
        openStatus = data.openStatus || {};

        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Belum Ada Lowongan</h3>
                    <p>Saat ini belum ada lowongan yang dibuka. Silakan cek kembali nanti.</p>
                </div>
            `;
            countEl.textContent = "0 lowongan tersedia";
            return;
        }

        const openCount = jobs.filter((j) => openStatus[j.id] !== false).length;
        countEl.textContent = `${openCount} dari ${jobs.length} lowongan sedang dibuka`;

        renderFilteredJobs();

        // Attach event listeners ke tombol daftar
        document.getElementById("jobsContainer").addEventListener("click", handleJobsClick);
        // Attach event listeners ke tombol filter
        document.querySelectorAll("#filterBar .filter-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                currentFilter = btn.dataset.filter;
                document.querySelectorAll("#filterBar .filter-btn").forEach((b) =>
                    b.classList.toggle("active", b === btn)
                );
                renderFilteredJobs();
            });
        });
    } catch (err) {
        console.error("Error loading jobs:", err);
        container.innerHTML = `
            <div class="empty-state">
                <h3>Gagal Memuat Lowongan</h3>
                <p>Silakan refresh halaman atau coba lagi nanti.</p>
            </div>
        `;
        countEl.textContent = "";
    }
}

function getFilteredJobs() {
    if (currentFilter === "all") return jobs;
    return jobs.filter((j) => j.gender === currentFilter);
}

function renderFilteredJobs() {
    const container = document.getElementById("jobsContainer");
    const filtered = getFilteredJobs();
    if (filtered.length === 0 && jobs.length > 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Tidak Ada Lowongan ${currentFilter === "male" ? "Pria" : "Wanita"}</h3>
                <p>Coba filter lain atau cek kembali nanti.</p>
            </div>
        `;
        return;
    }
    container.innerHTML = filtered.map(renderJobCard).join("");
}

function handleJobsClick(e) {
    const detailBtn = e.target.closest("[data-detail-job]");
    if (detailBtn) {
        openDetailModal(detailBtn.dataset.detailJob);
        return;
    }
    const registerBtn = e.target.closest("[data-register-job]");
    if (registerBtn) {
        openRegisterModal(registerBtn.dataset.registerJob);
    }
}

function renderJobCard(job) {
    const isOpen = openStatus[job.id] !== false; // default true
    const isHidden = !!job.isHidden;
    const statusClass = isOpen ? "open" : "closed";
    const statusLabel = isOpen ? "DIBUKA" : "DITUTUP";
    const slots = Number(job.slots || job.vacancies || 0);
    const available = Number(job.available != null ? job.available : Math.max(0, slots - Number(job.filled || 0)));
    const filledPct = slots > 0 ? (available / slots) * 100 : 0;
    const genderLabel = job.gender === "male" ? "Pria" : job.gender === "female" ? "Wanita" : null;
    const genderIcon = job.gender === "male" ? "👨" : job.gender === "female" ? "👩" : null;
    const genderClass = job.gender === "male" ? "gender-male" : job.gender === "female" ? "gender-female" : "";

    return `
        <div class="job-card ${isOpen ? "" : "closed"} ${isHidden ? 'job-card-hidden' : ''}">
            <div class="job-card-header">
                <div class="job-card-company">
                    <div class="job-card-company-name">
                        <div class="job-card-company-jp jp">${escapeHtml(job.company.jp)}</div>
                        <div class="job-card-company-romaji">${escapeHtml(job.company.romaji)}</div>
                    </div>
                    <span class="job-status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="job-card-industry">${escapeHtml(job.industry)}${genderLabel ? ` <span class="job-gender-tag ${genderClass}">${genderIcon} ${genderLabel}</span>` : ""}</div>
                <div class="job-card-industry-jp">${escapeHtml(job.industryJp || "")}</div>
            </div>

            <div class="job-card-body">
                <div class="job-info-row">
                    <span class="job-info-icon">📍</span>
                    <span class="job-info-label">Lokasi</span>
                    <span class="job-info-value">${escapeHtml(job.location)}</span>
                </div>
                <div class="job-info-row">
                    <span class="job-info-icon">👥</span>
                    <span class="job-info-label">Dicari</span>
                    <span class="job-info-value">${escapeHtml(String(job.vacancies))} orang (kandidat ${job.candidates || 0})</span>
                </div>

                <div class="job-salary">
                    <div class="job-salary-row">
                        <span class="job-salary-label">Gaji Kotor</span>
                        <span class="job-salary-value">${formatYen(job.salary.gross)}/bln</span>
                    </div>
                    <div class="job-salary-row">
                        <span class="job-salary-label">Gaji Bersih</span>
                        <span class="job-salary-value job-salary-value-lg">${formatYen(job.salary.net)}/bln</span>
                    </div>
                </div>

                ${slots > 0 ? `
                <div class="job-slot">
                    <div class="job-slot-info">
                        <span class="job-slot-label">🎯 Slot tersisa</span>
                        <span class="job-slot-value ${available === 0 ? 'job-slot-full' : ''}">${available} / ${slots}</span>
                    </div>
                    <div class="job-slot-bar">
                        <div class="job-slot-fill" style="width: ${filledPct}%"></div>
                    </div>
                </div>
                ` : ""}
            </div>

            <div class="job-card-footer">
                <div class="job-interview">
                    <span>Interview ${job.interview.type === "offline" ? "Offline" : "Online"}</span>
                    <strong>${formatDate(job.interview.date)}</strong>
                </div>
                <div class="job-card-actions">
                    <button class="btn-detail" data-detail-job="${escapeHtml(job.id)}" aria-label="Lihat detail lowongan">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Detail
                    </button>
                    <button
                        class="btn-daftar"
                        data-register-job="${escapeHtml(job.id)}"
                        ${isOpen ? "" : "disabled"}
                    >
                        ${isOpen ? "DAFTAR" : "DITUTUP"}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ===== Modal Logic =====
function openRegisterModal(jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    if (openStatus[jobId] === false) {
        alert("Pendaftaran untuk lowongan ini sudah ditutup.");
        return;
    }

    const modal = document.getElementById("registerModal");
    const jobIdInput = document.getElementById("jobId");
    const jobTitleEl = document.getElementById("modalJobTitle");
    const form = document.getElementById("registerForm");
    const successState = document.getElementById("successState");
    const formError = document.getElementById("formError");

    jobIdInput.value = jobId;
    jobTitleEl.innerHTML = `Untuk lowongan: <strong>${escapeHtml(job.company.romaji)}</strong>`;

    // Reset state
    form.classList.remove("hidden");
    successState.classList.add("hidden");
    formError.classList.add("hidden");
    form.reset();
    jobIdInput.value = jobId; // re-set after reset
    document.getElementById("submitBtn").disabled = false;
    document.getElementById("submitBtn").textContent = "KIRIM PENDAFTARAN";

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    setTimeout(() => document.getElementById("regName").focus(), 100);
}

function closeRegisterModal() {
    const modal = document.getElementById("registerModal");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

// ===== Detail Modal =====
function openDetailModal(jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const modal = document.getElementById("detailModal");
    document.getElementById("detailCompanyJp").textContent = job.company.jp;
    document.getElementById("detailCompanyRomaji").textContent = job.company.romaji;
    document.getElementById("detailBody").innerHTML = renderDetailBody(job);

    const isOpen = openStatus[jobId] !== false;
    const daftarBtn = document.getElementById("detailDaftarBtn");
    if (isOpen) {
        daftarBtn.style.display = "";
        daftarBtn.onclick = () => {
            closeDetailModal();
            openRegisterModal(jobId);
        };
    } else {
        daftarBtn.style.display = "none";
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeDetailModal() {
    const modal = document.getElementById("detailModal");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function renderDetailBody(job) {
    const isOpen = openStatus[job.id] !== false;
    const salaryHourly = job.salary.grossHourly
        ? ` <span class="detail-value-sub">(${formatYen(job.salary.grossHourly)}/jam)</span>`
        : "";
    const vacanciesText = `${job.vacancies} orang (kandidat ${job.candidates || 0})`;
    const slots = Number(job.slots || job.vacancies || 0);
    const available = Number(job.available != null ? job.available : Math.max(0, slots - Number(job.filled || 0)));
    const genderText = job.gender === "male" ? "Pria saja" : job.gender === "female" ? "Wanita saja" : "Pria & Wanita";

    let html = `
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">📋 Industri</span>
                <span class="detail-value">${escapeHtml(job.industry)}${job.industryJp ? ` <span class="detail-value-sub jp">${escapeHtml(job.industryJp)}</span>` : ""}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">📍 Lokasi</span>
                <span class="detail-value">${escapeHtml(job.location)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">👥 Dicari</span>
                <span class="detail-value">${escapeHtml(vacanciesText)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">👤 Gender</span>
                <span class="detail-value">${genderText}</span>
            </div>
            <div class="detail-item detail-item-salary">
                <span class="detail-label">💰 Gaji Kotor</span>
                <span class="detail-value">${formatYen(job.salary.gross)}/bln${salaryHourly}</span>
            </div>
            <div class="detail-item detail-item-salary">
                <span class="detail-label">💵 Gaji Bersih</span>
                <span class="detail-value detail-value-strong">${formatYen(job.salary.net)}/bln</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">📅 Interview</span>
                <span class="detail-value">${job.interview.type === "offline" ? "Offline" : "Online"} — <strong>${formatDate(job.interview.date)}</strong></span>
            </div>
            ${slots > 0 ? `
            <div class="detail-item">
                <span class="detail-label">🎯 Slot Tersisa</span>
                <span class="detail-value ${available === 0 ? 'detail-value-full' : ''}">${available} dari ${slots} ${available === 0 ? '· PENUH' : ''}</span>
            </div>
            ` : ""}
        </div>
    `;

    if (job.description) {
        html += `
            <div class="detail-section">
                <h3>Deskripsi Pekerjaan</h3>
                <p>${escapeHtml(job.description)}</p>
            </div>
        `;
    }

    if (Array.isArray(job.requirements) && job.requirements.length > 0) {
        html += `
            <div class="detail-section">
                <h3>Persyaratan</h3>
                <ol class="detail-list">
                    ${job.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
                </ol>
            </div>
        `;
    }

    if (job.mensetsuNotes) {
        html += `
            <div class="detail-section detail-section-notes">
                <h3>⚠️ Catatan Mensetsu</h3>
                <p>${escapeHtml(job.mensetsuNotes)}</p>
            </div>
        `;
    }

    return html;
}

// Close modal handlers
document.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) {
        closeRegisterModal();
    }
    if (e.target.matches("[data-close-detail]")) {
        closeDetailModal();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeRegisterModal();
        closeDetailModal();
    }
});

// ===== Form Submit =====
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById("submitBtn");
        const formError = document.getElementById("formError");
        const formData = new FormData(form);
        const data = {
            jobId: formData.get("jobId"),
            name: formData.get("name")?.trim(),
            phone: formData.get("phone")?.trim(),
        };

        // Basic validation
        if (!data.name || data.name.length < 2) {
            showFormError("Nama lengkap minimal 2 karakter.");
            return;
        }
        if (!data.phone || data.phone.replace(/\D/g, "").length < 8) {
            showFormError("Nomor handphone tidak valid (min. 8 digit).");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "MENGIRIM...";
        formError.classList.add("hidden");

        try {
            const res = await fetch(REGISTER_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (res.ok && result.success) {
                // Show success
                form.classList.add("hidden");
                document.getElementById("successState").classList.remove("hidden");
            } else {
                showFormError(result.error || "Pendaftaran gagal. Silakan coba lagi.");
                submitBtn.disabled = false;
                submitBtn.textContent = "KIRIM PENDAFTARAN";
            }
        } catch (err) {
            console.error("Register error:", err);
            showFormError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
            submitBtn.disabled = false;
            submitBtn.textContent = "KIRIM PENDAFTARAN";
        }
    });

    function showFormError(msg) {
        const formError = document.getElementById("formError");
        formError.textContent = msg;
        formError.classList.remove("hidden");
    }

    // Load jobs on page load
    loadJobs();
});
