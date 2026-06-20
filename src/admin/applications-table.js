import { debounce, escapeHtml, qs, qsa } from "../shared/dom.js";
import { formatDateTime } from "../shared/format.js";
import { toast } from "../shared/toast.js";

const STATUS_LABEL = { lolos: "Lolos", tidak_lolos: "Tidak Lolos", pending: "Pending" };
function statusLabel(s) {
  return STATUS_LABEL[s] || "Pending";
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

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    renderFilterChips();
    render();
  }

  function renderFilterChips() {
    const wrap = qs("#regFilterChips");
    if (!wrap) return;
    const jobId = qs("#filterJob").value;
    const status = qs("#filterStatus").value;
    const search = qs("#filterSearch").value.trim();

    const jobChip = qs('[data-clear="job"]', wrap);
    const statusChip = qs('[data-clear="status"]', wrap);
    const searchChip = qs('[data-clear="search"]', wrap);

    let activeCount = 0;
    if (jobId) {
      const job = jobMap[jobId];
      qs(".filter-chip-val", jobChip).textContent = job ? job.company.romaji : jobId;
      jobChip.hidden = false;
      activeCount++;
    } else {
      jobChip.hidden = true;
    }
    if (status) {
      qs(".filter-chip-val", statusChip).textContent = statusLabel(status);
      statusChip.hidden = false;
      activeCount++;
    } else {
      statusChip.hidden = true;
    }
    if (search) {
      qs(".filter-chip-val", searchChip).textContent = `“${search}”`;
      searchChip.hidden = false;
      activeCount++;
    } else {
      searchChip.hidden = true;
    }

    wrap.hidden = activeCount === 0;

    // Update search clear button visibility
    const clearBtn = qs("#filterSearchClear");
    if (clearBtn) clearBtn.hidden = !search;
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

  function skeletonHTML() {
    return `
      <div class="skeleton-table-head" aria-hidden="true">
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
      </div>
      ${Array.from({ length: 5 }, () => `
        <div class="skeleton-row" aria-hidden="true">
          <div class="skeleton skeleton-cell"></div>
          <div class="skeleton skeleton-cell"></div>
          <div class="skeleton skeleton-cell"></div>
          <div class="skeleton skeleton-cell"></div>
          <div class="skeleton skeleton-cell"></div>
          <div class="skeleton skeleton-cell"></div>
        </div>
      `).join("")}
    `;
  }

  function emptyState(title, hint, icon) {
    const svg = icon || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;
    return `
      <div class="reg-empty">
        <div class="reg-empty-icon" aria-hidden="true">${svg}</div>
        <p class="reg-empty-title">${escapeHtml(title)}</p>
        ${hint ? `<p class="reg-empty-hint">${escapeHtml(hint)}</p>` : ""}
      </div>
    `;
  }

  function render() {
    const body = qs("#registrationsPanel");
    if (allRegs.length === 0) {
      body.innerHTML = emptyState(
        "Belum ada pendaftar",
        "Pendaftar dari landing page akan muncul di sini secara otomatis."
      );
      return;
    }
    if (filteredRegs.length === 0) {
      body.innerHTML = emptyState(
        "Tidak ada hasil",
        "Coba ubah filter atau klik \"Refresh\"."
      );
      return;
    }
    const rows = filteredRegs.map((r, i) => {
      const job = jobMap[r.jobId];
      const company = job ? job.company.romaji : r.jobId;
      const status = r.status || "pending";
      const phoneDigits = (r.phone || "").replace(/\D/g, "");
      const phoneHtml = phoneDigits
        ? `<a href="${toWaLink(phoneDigits)}" target="_blank" rel="noopener" title="Chat WhatsApp">${escapeHtml(r.phone || "")}</a>`
        : `<span style="color:var(--color-text-subtle)">—</span>`;
      const avatarColors = ["#1e3a5f", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];
      const avatarBg = avatarColors[i % avatarColors.length];
      return `
        <tr data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}">
          <td class="reg-num">${i + 1}</td>
          <td>
            <div class="reg-name-cell">
              <div class="reg-avatar" aria-hidden="true" style="background:${avatarBg}">${escapeHtml(initials(r.name))}</div>
              <div class="reg-name-meta">
                <div class="reg-name">${escapeHtml(r.name || "")}</div>
                <div class="reg-sub">${escapeHtml(formatDateTime(r.timestamp))}</div>
              </div>
            </div>
          </td>
          <td>${phoneHtml}</td>
          <td class="reg-job-cell">
            <div class="reg-job-company">${escapeHtml(company)}</div>
            <div class="reg-sub">${escapeHtml(job ? job.location : "")}</div>
          </td>
          <td><span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span></td>
          <td class="reg-actions">
            <button class="btn btn-sm btn-success" data-set-status="lolos" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" ${status === "lolos" ? "disabled" : ""} type="button" title="Set Lolos">Lolos</button>
            <button class="btn btn-sm btn-danger" data-set-status="tidak_lolos" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" ${status === "tidak_lolos" ? "disabled" : ""} type="button" title="Set Tidak Lolos">Tidak</button>
            ${status !== "pending" ? `<button class="btn btn-sm btn-link" data-set-status="pending" data-reg-id="${escapeHtml(r.id)}" data-job-id="${escapeHtml(r.jobId)}" type="button" title="Reset ke Pending">Reset</button>` : ""}
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
    panel.innerHTML = skeletonHTML();
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
      window.dispatchEvent(new CustomEvent("admin:data-loaded", { detail: { source: "registrations", count: allRegs.length } }));
    } catch (err) {
      if (err.status === 401) {
        panel.innerHTML = emptyState("Password salah", "Silakan login ulang.");
        return;
      }
      panel.innerHTML = emptyState("Gagal memuat data", err.message || "Pastikan Neon Postgres sudah di-setup di Vercel.");
    }
  }

  function initFilters() {
    qs("#filterJob").addEventListener("change", applyFilters);
    qs("#filterStatus").addEventListener("change", applyFilters);
    qs("#filterSearch").addEventListener("input", debounce(() => {
      applyFilters();
    }, 220));
    qs("#btnRefresh").addEventListener("click", () => {
      const btn = qs("#btnRefresh");
      btn.classList.add("btn-refreshing");
      load().finally(() => btn.classList.remove("btn-refreshing"));
    });

    // Search clear button
    const searchClear = qs("#filterSearchClear");
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        const input = qs("#filterSearch");
        input.value = "";
        input.focus();
        applyFilters();
      });
    }

    // Filter chips
    const chipsWrap = qs("#regFilterChips");
    if (chipsWrap) {
      chipsWrap.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-clear]");
        if (!chip) return;
        const which = chip.dataset.clear;
        if (which === "job") qs("#filterJob").value = "";
        if (which === "status") qs("#filterStatus").value = "";
        if (which === "search") qs("#filterSearch").value = "";
        applyFilters();
      });
      const clearAll = qs("#filterChipsClearAll");
      if (clearAll) {
        clearAll.addEventListener("click", () => {
          qs("#filterJob").value = "";
          qs("#filterStatus").value = "";
          qs("#filterSearch").value = "";
          applyFilters();
        });
      }
    }

    // Keyboard: "/" focuses search
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "SELECT") {
        const input = qs("#filterSearch");
        if (input && !qs("#tab-registrations").hidden) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        if (!qs("#tab-registrations").hidden) {
          qs("#btnRefresh").click();
        }
      }
    });
  }

  function getFiltered() { return filteredRegs; }
  function getJobMap() { return jobMap; }

  return { load, applyFilters, render, getFiltered, getJobMap, initFilters };
}
