import { escapeHtml, qs } from "../shared/dom.js";
import { formatDateTime } from "../shared/format.js";

function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 5) return "baru saja";
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} hari lalu`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month} bulan lalu`;
  return `${Math.round(month / 12)} tahun lalu`;
}

function relativeTimeRefresh(el, iso) {
  const tick = () => {
    el.textContent = relativeTime(iso);
    el.setAttribute("title", formatDateTime(iso));
  };
  tick();
  return setInterval(tick, 30_000);
}

let _relativeTimers = [];

function stopRelativeTimers() {
  _relativeTimers.forEach((id) => clearInterval(id));
  _relativeTimers = [];
}

export function createHistory({ api }) {
  async function load() {
    const panel = qs("#historyPanel");
    panel.innerHTML = `
      <div class="skeleton-row history" aria-hidden="true">
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
      </div>
      <div class="skeleton-row history" aria-hidden="true">
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
      </div>
      <div class="skeleton-row history" aria-hidden="true">
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
      </div>
    `;
    try {
      const [jobsRes, data] = await Promise.all([
        api.getJobs({ includeHidden: true }).catch(() => ({ jobs: [] })),
        api.getVisibilityLog(),
      ]);
      const jobMap = {};
      for (const j of (jobsRes.jobs || [])) jobMap[j.id] = j;
      render(data.log || [], jobMap);
      window.dispatchEvent(new CustomEvent("admin:data-loaded", { detail: { source: "history" } }));
    } catch (err) {
      panel.innerHTML = `<div class="reg-empty">
        <div class="reg-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p class="reg-empty-title">Gagal memuat riwayat</p>
        <p class="reg-empty-hint">${escapeHtml(err.message || "")}</p>
      </div>`;
    }
  }

  function render(log, jobMap) {
    const panel = qs("#historyPanel");
    stopRelativeTimers();
    if (log.length === 0) {
      panel.innerHTML = `<div class="reg-empty">
        <div class="reg-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <p class="reg-empty-title">Belum ada aktivitas</p>
        <p class="reg-empty-hint">Riwayat hide/unhide akan muncul di sini setelah ada lowongan yang di-hide, lalu di-unhide kembali.</p>
      </div>`;
      return;
    }
    const rows = log.map((entry) => {
      const isHide = entry.action === "hide";
      const actionLabel = isHide ? "🔒 Hide" : "👁 Unhide";
      const actionClass = isHide ? "history-hide" : "history-unhide";
      const id = entry.job_id || entry.jobId;
      const job = jobMap[id];
      const company = job ? job.company.romaji : id;
      return `
        <tr>
          <td class="history-job-cell">
            <strong>${escapeHtml(company)}</strong>
            ${job ? `<span class="history-job-id">${escapeHtml(id)}</span>` : ""}
          </td>
          <td><span class="history-action ${actionClass}">${actionLabel}</span></td>
          <td>
            <div>${escapeHtml(formatDateTime(entry.timestamp))}</div>
            <time class="history-relative" datetime="${escapeHtml(entry.timestamp || "")}">${escapeHtml(relativeTime(entry.timestamp))}</time>
          </td>
        </tr>
      `;
    }).join("");
    panel.innerHTML = `
      <div class="reg-table-wrap">
        <table class="reg-table">
          <caption class="sr-only">Riwayat hide/unhide lowongan</caption>
          <thead>
            <tr>
              <th scope="col">Lowongan</th>
              <th scope="col">Aksi</th>
              <th scope="col">Waktu</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="history-note">${log.length} aktivitas tercatat. Lowongan yang di-hide tetap bisa di-restore lewat tab Kelola Lowongan.</p>
    `;
    // Start relative-time refreshers
    qsa("time.history-relative", panel).forEach((el) => {
      const iso = el.getAttribute("datetime");
      if (iso) _relativeTimers.push(relativeTimeRefresh(el, iso));
    });
  }

  return { load };
}
