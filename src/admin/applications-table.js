import { debounce, escapeHtml, qs, qsa } from "../shared/dom.js";
import { formatDateTime } from "../shared/format.js";
import { toast } from "../shared/toast.js";

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

/**
 * Build a wa.me link from a raw phone number string.
 * Indonesian numbers starting with "0" are converted to country code "62".
 * Other numbers are passed through as-is (preserving any leading "+" stripped to digits).
 */
function toWaLink(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return "#";
  const normalized = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

export function createApplicationsTable({ api }) {
  let allRegs = [];
  let filteredRegs = [];
  let jobMap = {};
  let jobs = [];

  function populateJobFilter() {
    const sel = qs("#filterJob");
    const current = sel.value;
    sel.innerHTML = `<option value="">Semua Lowongan</option>` +
      jobs.map((j) => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.company.romaji)}</option>`).join("");
    if (current) sel.value = current;
  }

  function applyFilters() {
    const jobId = qs("#filterJob").value;
    const status = qs("#filterStatus").value;
    const search = qs("#filterSearch").value.trim().toLowerCase();

    filteredRegs = allRegs.filter((r) => {
      if (jobId && r.jobId !== jobId) return false;
      const currentStatus = r.status || "pending";
      if (status && currentStatus !== status) return false;
      if (search) {
        const hay = `${r.name} ${r.phone}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    updateStats();
    render();
  }

  function updateStats() {
    const total = allRegs.length;
    const lolos = allRegs.filter((r) => (r.status || "pending") === "lolos").length;
    const tidak = allRegs.filter((r) => (r.status || "pending") === "tidak_lolos").length;
    const pending = allRegs.filter((r) => (r.status || "pending") === "pending").length;
    qs("#statTotal").textContent = total;
    qs("#statLolos").textContent = lolos;
    qs("#statTidak").textContent = tidak;
    qs("#statPending").textContent = pending;
  }

  function render() {
    const body = qs("#registrationsPanel");
    if (allRegs.length === 0) {
      body.innerHTML = `<div class="reg-empty">
        <p>Belum ada pendaftar dari lowongan manapun.</p>
        <p class="reg-empty-hint">Pendaftar dari landing page akan muncul di sini secara otomatis.</p>
      </div>`;
      return;
    }
    if (filteredRegs.length === 0) {
      body.innerHTML = `<div class="reg-empty">
        <p>Tidak ada pendaftar yang cocok dengan filter saat ini.</p>
        <p class="reg-empty-hint">Coba ubah filter atau klik "Refresh".</p>
      </div>`;
      return;
    }
    const rows = filteredRegs.map((r, i) => {
      const job = jobMap[r.jobId];
      const company = job ? job.company.romaji : r.jobId;
      const status = r.status || "pending";
      const phoneDigits = (r.phone || "").replace(/\D/g, "");
      return `
        <tr data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}">
          <td class="reg-num">${i + 1}</td>
          <td>
            <div class="reg-name">${escapeHtml(r.name || "")}</div>
            <div class="reg-sub">${escapeHtml(formatDateTime(r.timestamp))}</div>
          </td>
          <td>${phoneDigits
            ? `<a href="${toWaLink(phoneDigits)}" target="_blank" rel="noopener">${escapeHtml(r.phone || "")}</a>`
            : escapeHtml(r.phone || "")}</td>
          <td class="reg-job-cell">
            <div class="reg-job-company">${escapeHtml(company)}</div>
            <div class="reg-sub">${escapeHtml(job ? job.location : "")}</div>
          </td>
          <td><span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span></td>
          <td class="reg-actions">
            <button class="btn btn-sm btn-success" data-set-status="lolos" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" ${status === "lolos" ? "disabled" : ""} type="button">Lolos</button>
            <button class="btn btn-sm btn-danger" data-set-status="tidak_lolos" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" ${status === "tidak_lolos" ? "disabled" : ""} type="button">Tidak</button>
            ${status !== "pending" ? `<button class="btn btn-sm btn-link" data-set-status="pending" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" type="button">Reset</button>` : ""}
          </td>
        </tr>
      `;
    }).join("");
    body.innerHTML = `
      <div class="reg-table-wrap">
        <table class="reg-table">
          <caption class="sr-only">Daftar pendaftar</caption>
          <thead>
            <tr>
              <th class="reg-num" scope="col">#</th>
              <th scope="col">Nama / Waktu</th>
              <th scope="col">No. HP</th>
              <th scope="col">Lowongan</th>
              <th scope="col">Status</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    qsa("[data-set-status]", body).forEach((btn) => {
      btn.addEventListener("click", () => handleStatus(btn.dataset.regId, btn.dataset.jobId, btn.dataset.setStatus, btn));
    });
  }

  async function handleStatus(regId, jobId, status, btn) {
    btn.disabled = true;
    try {
      await api.setStatus(regId, jobId, status);
      const reg = allRegs.find((r) => r.id === regId);
      if (reg) {
        reg.status = status;
        reg.statusUpdatedAt = new Date().toISOString();
      }
      applyFilters();
      toast({ message: `Status diubah ke ${statusLabel(status)}.`, type: "success" });
    } catch (err) {
      toast({ message: err.message || "Gagal update status.", type: "error" });
      btn.disabled = false;
    }
  }

  async function load() {
    const panel = qs("#registrationsPanel");
    panel.innerHTML = `<div class="loading"><div class="spinner" aria-hidden="true"></div><p>Memuat...</p></div>`;
    try {
      const [jobsRes, regsRes] = await Promise.all([
        api.getJobs(),
        api.getAllRegistrations(),
      ]);
      jobs = jobsRes.jobs || [];
      jobMap = {};
      for (const j of jobs) jobMap[j.id] = j;
      allRegs = regsRes.registrations || [];
      allRegs.forEach((r) => { if (!r.status) r.status = "pending"; });
      populateJobFilter();
      applyFilters();
    } catch (err) {
      if (err.status === 401) {
        panel.innerHTML = `<div class="reg-empty">Password salah. Silakan login ulang.</div>`;
        return;
      }
      panel.innerHTML = `<div class="reg-empty">${escapeHtml(err.message || "Gagal memuat data.")}<br><br>Pastikan <strong>Neon Postgres</strong> sudah di-setup di Vercel.</div>`;
    }
  }

  function initFilters() {
    qs("#filterJob").addEventListener("change", applyFilters);
    qs("#filterStatus").addEventListener("change", applyFilters);
    qs("#filterSearch").addEventListener("input", debounce(applyFilters, 220));
    qs("#btnRefresh").addEventListener("click", load);
  }

  function getFiltered() { return filteredRegs; }
  function getJobMap() { return jobMap; }

  return { load, applyFilters, render, getFiltered, getJobMap, initFilters };
}
