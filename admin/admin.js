// ===== State =====
let adminPassword = sessionStorage.getItem("admin_password") || "";
let jobsData = null;
let allRegs = [];      // current full list from server (across all jobs)
let filteredRegs = []; // after applying filters
let jobMap = {};       // jobId -> { romaji, jp, industry, location }

// ===== API =====
const JOBS_API = "/api/jobs";
const ADMIN_API = "/api/admin";

function authHeaders() {
    return { "X-Admin-Password": adminPassword };
}

function statusLabel(s) {
    if (s === "lolos") return "Lolos";
    if (s === "tidak_lolos") return "Tidak Lolos";
    return "Pending";
}

function statusClass(s) {
    if (s === "lolos") return "status-lolos";
    if (s === "tidak_lolos") return "status-tidak";
    return "status-pending";
}

// ===== Login =====
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const passwordInput = document.getElementById("passwordInput");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const pwd = passwordInput.value;
    if (!pwd) return;

    const testRes = await fetch(JOBS_API);
    if (!testRes.ok) {
        loginError.textContent = "Server tidak merespons. Coba lagi.";
        return;
    }

    adminPassword = pwd;
    sessionStorage.setItem("admin_password", pwd);

    const verifyRes = await fetch(`${ADMIN_API}?jobId=_verify`, { headers: authHeaders() });
    if (verifyRes.status === 401) {
        loginError.textContent = "Password salah.";
        adminPassword = "";
        sessionStorage.removeItem("admin_password");
        return;
    }

    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    loadJobsManagement();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    adminPassword = "";
    sessionStorage.removeItem("admin_password");
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    passwordInput.value = "";
});

// ===== Tabs =====
document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

        if (tab.dataset.tab === "registrations") {
            loadRegistrations();
        }
    });
});

// ===== Jobs Management =====
async function loadJobsManagement() {
    const list = document.getElementById("jobsList");
    list.innerHTML = `<div class="loading"><div class="spinner"></div><p>Memuat...</p></div>`;

    try {
        const res = await fetch(JOBS_API);
        if (!res.ok) throw new Error("Failed");
        jobsData = await res.json();
        jobMap = {};
        for (const j of jobsData.jobs) jobMap[j.id] = j;
        renderJobsList();
    } catch (err) {
        list.innerHTML = `<div class="reg-empty">Gagal memuat lowongan.</div>`;
    }
}

function renderJobsList() {
    const list = document.getElementById("jobsList");

    if (!jobsData?.jobs?.length) {
        list.innerHTML = `<div class="reg-empty">Belum ada lowongan.</div>`;
        return;
    }

    list.innerHTML = jobsData.jobs.map((job) => {
        const isOpen = jobsData.openStatus[job.id] !== false;
        return `
            <div class="job-row" data-job-id="${escapeHtml(job.id)}">
                <div class="job-row-info">
                    <div class="job-row-company">${escapeHtml(job.company.romaji)}</div>
                    <div class="job-row-meta">${escapeHtml(job.industry)} · ${escapeHtml(job.location)} · ${job.vacancies} lowongan</div>
                </div>
                <div class="job-row-status">
                    <span class="status-pill ${isOpen ? "open" : "closed"}">${isOpen ? "DIBUKA" : "DITUTUP"}</span>
                </div>
                <div class="job-row-actions">
                    <button class="btn btn-sm ${isOpen ? "btn-danger" : "btn-success"}" data-toggle="${escapeHtml(job.id)}" data-open="${isOpen ? "true" : "false"}">
                        ${isOpen ? "TUTUP" : "BUKA"}
                    </button>
                </div>
            </div>
        `;
    }).join("");

    list.querySelectorAll("[data-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => toggleJob(btn.dataset.toggle, btn.dataset.open === "true"));
    });
}

async function toggleJob(jobId, currentlyOpen) {
    const newStatus = !currentlyOpen;
    const btn = document.querySelector(`[data-toggle="${jobId}"]`);
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(ADMIN_API, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ action: "toggle", jobId, isOpen: newStatus, password: adminPassword }),
        });

        const result = await res.json();
        if (res.ok && result.success) {
            await loadJobsManagement();
        } else {
            alert(result.error || "Gagal update");
            if (btn) btn.disabled = false;
        }
    } catch (err) {
        alert("Gagal terhubung ke server");
        if (btn) btn.disabled = false;
    }
}

// ===== Registrations: unified list, filter, status, export =====

async function loadRegistrations() {
    const panel = document.getElementById("registrationsPanel");
    panel.innerHTML = `<div class="loading"><div class="spinner"></div><p>Memuat...</p></div>`;

    try {
        // Load jobs (for filter dropdown) and all regs in parallel
        const [jobsRes, regsRes] = await Promise.all([
            fetch(JOBS_API),
            fetch(`${ADMIN_API}?all=1`, { headers: authHeaders() }),
        ]);

        if (!jobsRes.ok) throw new Error("Gagal load lowongan");
        jobsData = await jobsRes.json();
        jobMap = {};
        for (const j of jobsData.jobs) jobMap[j.id] = j;

        if (regsRes.status === 401) {
            panel.innerHTML = `<div class="reg-empty">Password salah. Silakan login ulang.</div>`;
            return;
        }
        if (!regsRes.ok) {
            const err = await regsRes.json().catch(() => ({}));
            panel.innerHTML = `<div class="reg-empty">${escapeHtml(err.error || "Gagal memuat data.")}<br><br>Pastikan <strong>Vercel KV / Upstash Redis</strong> sudah di-setup.</div>`;
            return;
        }

        const data = await regsRes.json();
        allRegs = data.registrations || [];

        // Backfill status for old records (pre-feature)
        for (const r of allRegs) {
            if (!r.status) r.status = "pending";
        }

        populateJobFilter();
        applyFilters();
    } catch (err) {
        panel.innerHTML = `<div class="reg-empty">Gagal terhubung ke server.</div>`;
    }
}

function populateJobFilter() {
    const sel = document.getElementById("filterJob");
    const current = sel.value;
    sel.innerHTML = `<option value="">Semua Lowongan</option>` +
        jobsData.jobs.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.company.romaji)}</option>`).join("");
    if (current) sel.value = current;
}

function applyFilters() {
    const jobId = document.getElementById("filterJob").value;
    const status = document.getElementById("filterStatus").value;
    const search = document.getElementById("filterSearch").value.trim().toLowerCase();

    filteredRegs = allRegs.filter((r) => {
        if (jobId && r.jobId !== jobId) return false;
        if (status && (r.status || "pending") !== status) return false;
        if (search) {
            const hay = `${r.name} ${r.phone}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    updateStats();
    renderRegistrationsTable();
}

function updateStats() {
    const total = allRegs.length;
    const lolos = allRegs.filter(r => (r.status || "pending") === "lolos").length;
    const tidak = allRegs.filter(r => (r.status || "pending") === "tidak_lolos").length;
    const pending = allRegs.filter(r => (r.status || "pending") === "pending").length;
    document.getElementById("statTotal").textContent = total;
    document.getElementById("statLolos").textContent = lolos;
    document.getElementById("statTidak").textContent = tidak;
    document.getElementById("statPending").textContent = pending;
}

function renderRegistrationsTable() {
    const body = document.getElementById("registrationsPanel");

    if (allRegs.length === 0) {
        body.innerHTML = `
            <div class="reg-empty">
                <p>Belum ada pendaftar dari lowongan manapun.</p>
                <p class="reg-empty-hint">Pendaftar dari landing page akan muncul di sini secara otomatis.</p>
            </div>
        `;
        return;
    }

    if (filteredRegs.length === 0) {
        body.innerHTML = `
            <div class="reg-empty">
                <p>Tidak ada pendaftar yang cocok dengan filter saat ini.</p>
                <p class="reg-empty-hint">Coba ubah filter atau klik "Refresh".</p>
            </div>
        `;
        return;
    }

    const rows = filteredRegs.map((r, i) => {
        const job = jobMap[r.jobId];
        const company = job ? job.company.romaji : r.jobId;
        const status = r.status || "pending";
        return `
            <tr data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}">
                <td class="reg-num">${i + 1}</td>
                <td>
                    <div class="reg-name">${escapeHtml(r.name)}</div>
                    <div class="reg-sub">${escapeHtml(formatDateTime(r.timestamp))}</div>
                </td>
                <td><a href="https://wa.me/${escapeHtml((r.phone || "").replace(/\D/g, ""))}" target="_blank" rel="noopener">${escapeHtml(r.phone || "")}</a></td>
                <td class="reg-job-cell">
                    <div class="reg-job-company">${escapeHtml(company)}</div>
                    <div class="reg-sub">${escapeHtml(job ? job.location : "")}</div>
                </td>
                <td><span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span></td>
                <td class="reg-actions">
                    <button class="btn btn-sm btn-success" data-set-status="lolos" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" ${status === "lolos" ? "disabled" : ""}>Lolos</button>
                    <button class="btn btn-sm btn-danger" data-set-status="tidak_lolos" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" ${status === "tidak_lolos" ? "disabled" : ""}>Tidak</button>
                    ${status !== "pending" ? `<button class="btn btn-sm btn-link" data-set-status="pending" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}">Reset</button>` : ""}
                </td>
            </tr>
        `;
    }).join("");

    body.innerHTML = `
        <div class="reg-table-wrap">
            <table class="reg-table">
                <thead>
                    <tr>
                        <th class="reg-num">#</th>
                        <th>Nama / Waktu</th>
                        <th>No. HP</th>
                        <th>Lowongan</th>
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    // Bind status buttons
    body.querySelectorAll("[data-set-status]").forEach((btn) => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.regId, btn.dataset.jobId, btn.dataset.setStatus, btn));
    });
}

async function updateStatus(regId, jobId, status, btn) {
    btn.disabled = true;
    try {
        const res = await fetch(ADMIN_API, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ action: "setStatus", regId, jobId, status, password: adminPassword }),
        });
        const result = await res.json();
        if (res.ok && result.success) {
            // Update local state and re-render
            const reg = allRegs.find(r => r.id === regId);
            if (reg) {
                reg.status = status;
                reg.statusUpdatedAt = new Date().toISOString();
            }
            applyFilters();
        } else {
            alert(result.error || "Gagal update status");
            btn.disabled = false;
        }
    } catch (err) {
        alert("Gagal terhubung ke server");
        btn.disabled = false;
    }
}

// ===== Filter wiring =====
document.getElementById("filterJob").addEventListener("change", applyFilters);
document.getElementById("filterStatus").addEventListener("change", applyFilters);
document.getElementById("filterSearch").addEventListener("input", debounce(applyFilters, 200));
document.getElementById("btnRefresh").addEventListener("click", loadRegistrations);

function debounce(fn, ms) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ===== Exports =====
document.getElementById("btnExportCSV").addEventListener("click", exportCSV);
document.getElementById("btnExportExcel").addEventListener("click", exportExcel);
document.getElementById("btnExportPDF").addEventListener("click", exportPDF);

function exportRows() {
    // Build rows from currently filtered set
    const headers = ["No", "Nama", "No. HP", "Lowongan", "Lokasi", "Waktu Daftar", "Status"];
    const rows = filteredRegs.map((r, i) => {
        const job = jobMap[r.jobId];
        return [
            i + 1,
            r.name || "",
            r.phone || "",
            job ? job.company.romaji : r.jobId,
            job ? job.location : "",
            formatDateTime(r.timestamp),
            statusLabel(r.status || "pending"),
        ];
    });
    return { headers, rows };
}

function exportCSV() {
    if (filteredRegs.length === 0) { alert("Tidak ada data untuk diexport."); return; }
    const { headers, rows } = exportRows();
    const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pendaftar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportExcel() {
    if (filteredRegs.length === 0) { alert("Tidak ada data untuk diexport."); return; }
    if (typeof XLSX === "undefined") { alert("Library Excel belum dimuat. Refresh halaman."); return; }
    const { headers, rows } = exportRows();
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
        { wch: 4 },  // No
        { wch: 24 }, // Nama
        { wch: 16 }, // HP
        { wch: 28 }, // Lowongan
        { wch: 18 }, // Lokasi
        { wch: 18 }, // Waktu
        { wch: 12 }, // Status
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendaftar");
    XLSX.writeFile(wb, `pendaftar-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportPDF() {
    if (filteredRegs.length === 0) { alert("Tidak ada data untuk diexport."); return; }
    if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
        alert("Library PDF belum dimuat. Refresh halaman.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Data Pendaftar - LPK PJB", 40, 40);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}  ·  Total: ${filteredRegs.length} pendaftar`, 40, 58);

    const { headers, rows } = exportRows();

    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 72,
        styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 24, halign: "right" },
            1: { cellWidth: 110 },
            2: { cellWidth: 90 },
            3: { cellWidth: 150 },
            4: { cellWidth: 100 },
            5: { cellWidth: 110 },
            6: { cellWidth: 70 },
        },
        margin: { left: 40, right: 40 },
    });

    doc.save(`pendaftar-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Helpers =====
function formatDateTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
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

// Auto-resume session
if (adminPassword) {
    fetch(`${ADMIN_API}?jobId=_verify`, { headers: authHeaders() }).then((res) => {
        if (res.status !== 401) {
            document.getElementById("loginScreen").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            loadJobsManagement();
        } else {
            sessionStorage.removeItem("admin_password");
            adminPassword = "";
        }
    });
}

// ===== Create Job Modal =====
(function setupCreateJob() {
    const modal = document.getElementById("createJobModal");
    const form = document.getElementById("createJobForm");
    const errorEl = document.getElementById("createJobError");
    const submitBtn = document.getElementById("createJobSubmitBtn");
    const openBtn = document.getElementById("btnCreateJob");
    if (!modal || !form || !openBtn) return;

    function openModal() {
        form.reset();
        errorEl.classList.add("hidden");
        errorEl.textContent = "";
        submitBtn.disabled = false;
        submitBtn.textContent = "Simpan Lowongan";
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    openBtn.addEventListener("click", openModal);
    document.addEventListener("click", (e) => {
        if (e.target.matches("[data-close-create-job]")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorEl.classList.add("hidden");
        errorEl.textContent = "";

        const fd = new FormData(form);
        const requirementsText = (fd.get("requirements") || "").toString().trim();
        const requirements = requirementsText
            ? requirementsText.split("\n").map((s) => s.trim()).filter(Boolean)
            : [];

        const job = {
            id: (fd.get("id") || "").toString().trim(),
            company: {
                jp: (fd.get("companyJp") || "").toString().trim(),
                romaji: (fd.get("companyRomaji") || "").toString().trim(),
            },
            industry: (fd.get("industry") || "").toString().trim(),
            industryJp: (fd.get("industryJp") || "").toString().trim(),
            location: (fd.get("location") || "").toString().trim(),
            vacancies: (fd.get("vacancies") || "").toString().trim(),
            candidates: fd.get("candidates") ? Number(fd.get("candidates")) : 0,
            salary: {
                gross: Number(fd.get("salaryGross")),
                grossHourly: fd.get("salaryHourly") ? Number(fd.get("salaryHourly")) : null,
                net: Number(fd.get("salaryNet")),
            },
            interview: {
                date: fd.get("interviewDate"),
                type: fd.get("interviewType"),
            },
            description: (fd.get("description") || "").toString().trim(),
            requirements,
            mensetsuNotes: (fd.get("mensetsuNotes") || "").toString().trim(),
        };

        submitBtn.disabled = true;
        submitBtn.textContent = "MENYIMPAN...";

        try {
            const res = await fetch(ADMIN_API, {
                method: "POST",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ action: "createJob", job, password: adminPassword }),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                closeModal();
                await loadJobsManagement();
                alert(`Lowongan "${result.job.company.romaji}" berhasil ditambahkan.`);
            } else {
                errorEl.textContent = result.error || "Gagal menyimpan lowongan";
                errorEl.classList.remove("hidden");
                submitBtn.disabled = false;
                submitBtn.textContent = "Simpan Lowongan";
            }
        } catch (err) {
            errorEl.textContent = "Gagal terhubung ke server";
            errorEl.classList.remove("hidden");
            submitBtn.disabled = false;
            submitBtn.textContent = "Simpan Lowongan";
        }
    });
})();
