import { escapeHtml, qs, qsa } from "../shared/dom.js";
import { formatDate } from "../shared/format.js";
import { slotStats } from "../shared/jobs.js";
import { toast } from "../shared/toast.js";
import { confirmDialog } from "../shared/toast.js";

export function createJobsTable({ api, onEdit }) {
  let jobsData = null;

  function render() {
    const list = qs("#jobsList");
    if (!jobsData?.jobs?.length) {
      list.innerHTML = `<div class="reg-empty">Belum ada lowongan.</div>`;
      return;
    }

    list.innerHTML = jobsData.jobs.map((job) => {
      const isOpen = jobsData.openStatus[job.id] !== false;
      const isHidden = Boolean(job.isHidden);
      const { slots, available } = slotStats(job);
      return `
        <div class="job-row ${isHidden ? "job-row-hidden" : ""}" data-job-id="${escapeHtml(job.id)}">
          <div class="job-row-info">
            <div class="job-row-company">
              ${escapeHtml(job.company.romaji)}
              ${isHidden ? '<span class="hidden-badge">🔒 HIDDEN</span>' : ""}
            </div>
            <div class="job-row-meta">
              ${escapeHtml(job.industry)} · ${escapeHtml(job.location)} · ${escapeHtml(String(job.vacancies ?? slots))} lowongan
              ${slots > 0 ? ` · <span class="slot-pill ${available === 0 ? "slot-full" : ""}">Slot ${available}/${slots}</span>` : ""}
              ${job.gender ? ` · <span class="gender-pill gender-${job.gender}">${
                job.gender === "male" ? "♂ Pria" :
                job.gender === "female" ? "♀ Wanita" : "⚥ Semua"
              }</span>` : ""}
              ${job.interview?.date ? ` · Interview ${formatDate(job.interview.date)}` : ""}
            </div>
          </div>
          <div class="job-row-status">
            <span class="status-pill ${isOpen ? "open" : "closed"}">${isOpen ? "DIBUKA" : "DITUTUP"}</span>
          </div>
          <div class="job-row-actions">
            <button class="btn btn-sm btn-edit" data-edit="${escapeHtml(job.id)}" type="button">✏ Edit</button>
            <button class="btn btn-sm ${isOpen ? "btn-warning" : "btn-success"}" data-toggle="${escapeHtml(job.id)}" data-open="${isOpen ? "true" : "false"}" type="button">
              ${isOpen ? "TUTUP" : "BUKA"}
            </button>
            <button class="btn btn-sm ${isHidden ? "btn-info" : "btn-secondary"}" data-visibility="${escapeHtml(job.id)}" data-hidden="${isHidden ? "true" : "false"}" title="${isHidden ? "Tampilkan di web" : "Sembunyikan dari web"}" type="button">
              ${isHidden ? "👁 UNHIDE" : "🔒 HIDE"}
            </button>
            <button class="btn btn-sm btn-destructive" data-delete="${escapeHtml(job.id)}" title="Hapus lowongan permanen (job DB) atau sembunyikan (job seed JSON)" type="button">
              🗑 HAPUS
            </button>
          </div>
        </div>
      `;
    }).join("");

    qsa("[data-toggle]", list).forEach((btn) => {
      btn.addEventListener("click", () => handleToggle(btn.dataset.toggle, btn.dataset.open === "true"));
    });
    qsa("[data-visibility]", list).forEach((btn) => {
      btn.addEventListener("click", () => handleVisibility(btn.dataset.visibility, btn.dataset.hidden === "true"));
    });
    qsa("[data-edit]", list).forEach((btn) => {
      btn.addEventListener("click", () => onEdit?.(btn.dataset.edit));
    });
    qsa("[data-delete]", list).forEach((btn) => {
      btn.addEventListener("click", () => handleDelete(btn.dataset.delete));
    });
  }

  async function handleToggle(jobId, currentlyOpen) {
    const btn = qs(`[data-toggle="${jobId}"]`);
    if (btn) btn.disabled = true;
    try {
      await api.toggleJob(jobId, !currentlyOpen);
      toast({ message: `Lowongan ${!currentlyOpen ? "dibuka" : "ditutup"}.`, type: "success" });
      await load();
    } catch (err) {
      toast({ message: err.message || "Gagal update status.", type: "error" });
      if (btn) btn.disabled = false;
    }
  }

  async function handleVisibility(jobId, currentlyHidden) {
    const btn = qs(`[data-visibility="${jobId}"]`);
    const action = !currentlyHidden ? "hide" : "unhide";
    const ok = await confirmDialog({
      title: !currentlyHidden ? "Sembunyikan Lowongan?" : "Tampilkan Lowongan?",
      message: !currentlyHidden
        ? "Lowongan ini tidak akan muncul di landing page sampai di-unhide kembali."
        : "Lowongan ini akan muncul kembali di landing page.",
      confirmText: !currentlyHidden ? "Sembunyikan" : "Tampilkan",
      cancelText: "Batal",
    });
    if (!ok) return;
    if (btn) btn.disabled = true;
    try {
      await api.toggleVisibility(jobId, !currentlyHidden);
      toast({ message: `Lowongan berhasil di-${action}.`, type: "success" });
      await load();
    } catch (err) {
      toast({ message: err.message || "Gagal update visibility.", type: "error" });
      if (btn) btn.disabled = false;
    }
  }

  async function handleDelete(jobId) {
    const ok = await confirmDialog({
      title: "Hapus Lowongan?",
      message:
        "Tindakan ini akan menghapus lowongan dari database permanen, " +
        "termasuk semua pendaftar terkait. Untuk lowongan seed (JSON), lowongan akan " +
        "disembunyikan dari web. Lanjutkan?",
      confirmText: "Hapus",
      cancelText: "Batal",
    });
    if (!ok) return;
    const btn = qs(`[data-delete="${jobId}"]`);
    if (btn) btn.disabled = true;
    try {
      const result = await api.deleteJob(jobId);
      const msg =
        result.action === "deleted"
          ? `Lowongan dihapus permanen (${result.deletedJob} job, ${result.deletedRegistrations} pendaftar).`
          : `Lowongan seed disembunyikan dari web. Edit data/jobs.json untuk hapus permanen.`;
      toast({ message: msg, type: "success" });
      await load();
    } catch (err) {
      toast({ message: err.message || "Gagal hapus lowongan.", type: "error" });
      if (btn) btn.disabled = false;
    }
  }

  async function load() {
    const list = qs("#jobsList");
    list.innerHTML = `<div class="loading"><div class="spinner" aria-hidden="true"></div><p>Memuat...</p></div>`;
    try {
      jobsData = await api.getJobs({ includeHidden: true });
      render();
    } catch (err) {
      list.innerHTML = `<div class="reg-empty">Gagal memuat lowongan: ${escapeHtml(err.message || "")}</div>`;
    }
  }

  function getJobs() { return jobsData?.jobs || []; }

  return { load, render, getJobs };
}
