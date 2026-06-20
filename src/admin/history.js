import { escapeHtml, qs } from "../shared/dom.js";
import { formatDateTime } from "../shared/format.js";

export function createHistory({ api }) {
  async function load() {
    const panel = qs("#historyPanel");
    panel.innerHTML = `<div class="loading"><div class="spinner" aria-hidden="true"></div><p>Memuat...</p></div>`;
    try {
      const data = await api.getVisibilityLog();
      render(data.log || []);
    } catch (err) {
      panel.innerHTML = `<div class="reg-empty">Gagal memuat riwayat: ${escapeHtml(err.message || "")}</div>`;
    }
  }

  function render(log) {
    const panel = qs("#historyPanel");
    if (log.length === 0) {
      panel.innerHTML = `<div class="reg-empty">Belum ada aktivitas hide/unhide. Riwayat akan muncul di sini setelah ada lowongan yang di-hide, lalu di-unhide kembali.</div>`;
      return;
    }
    const rows = log.map((entry) => {
      const isHide = entry.action === "hide";
      const actionLabel = isHide ? "🔒 Hide" : "👁 Unhide";
      const actionClass = isHide ? "history-hide" : "history-unhide";
      const id = entry.job_id || entry.jobId;
      return `
        <tr>
          <td>
            <strong>${escapeHtml(id)}</strong>
            <br><small style="color:#94a3b8">${escapeHtml(id)}</small>
          </td>
          <td><span class="history-action ${actionClass}">${actionLabel}</span></td>
          <td>${escapeHtml(formatDateTime(entry.timestamp))}</td>
        </tr>
      `;
    }).join("");
    panel.innerHTML = `
      <div class="reg-table-wrap">
        <table class="reg-table">
          <caption class="sr-only">Riwayat hide/unhide lowongan</caption>
          <thead>
            <tr>
              <th scope="col">Job ID</th>
              <th scope="col">Aksi</th>
              <th scope="col">Waktu</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="history-note">${log.length} aktivitas tercatat. Lowongan yang di-hide tetap bisa di-restore lewat tab Kelola Lowongan.</p>
    `;
  }

  return { load };
}
