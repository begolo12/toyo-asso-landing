import { escapeHtml, qs, qsa } from "../shared/dom.js";
import { formatDate } from "../shared/format.js";
import { slotStats } from "../shared/jobs.js";
import { t } from "../shared/i18n.js";
import { toast } from "../shared/toast.js";
import { confirmDialog } from "../shared/toast.js";

export function createJobsTable({ api, onEdit }) {
  let jobsData = null;

  function skeletonHTML() {
    return Array.from({ length: 3 }, () => `
      <div class="skeleton-row jobs" aria-hidden="true">
        <div class="skeleton skeleton-cell"></div>
        <div class="skeleton skeleton-cell"></div>
      </div>
    `).join("");
  }

  function emptyState(title, hint, icon, ctaHtml = "") {
    const svg = icon || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
    return `
      <div class="reg-empty">
        <div class="reg-empty-icon" aria-hidden="true">${svg}</div>
        <p class="reg-empty-title">${escapeHtml(title)}</p>
        ${hint ? `<p class="reg-empty-hint">${escapeHtml(hint)}</p>` : ""}
        ${ctaHtml}
      </div>
    `;
  }

  function render() {
    const list = qs("#jobsList");
    if (!jobsData?.jobs?.length) {
      list.innerHTML = emptyState(
        t("admin.empty.jobs.title"),
        t("admin.empty.jobs.hint"),
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
        `<button type="button" class="btn btn-primary" data-empty-create>${escapeHtml(t("admin.empty.jobs.cta"))}</button>`
      );
      const cta = list.querySelector("[data-empty-create]");
      if (cta) cta.addEventListener("click", () => qs("#btnCreateJob")?.click());
      return;
    }

    list.innerHTML = jobsData.jobs.map((job) => {
      const isOpen = jobsData.openStatus[job.id] !== false;
      const isHidden = Boolean(job.isHidden);
      const { slots, available, filledPct, accepted, acceptedPct } = slotStats(job);
      // Show target badge only when accepted is set AND meaningfully less than slots.
      const hasTarget = accepted != null && slots > 0 && accepted < slots;
      const hasQuota = accepted != null && slots > 0;
      const targetBadge = hasTarget
        ? `<span class="job-row-target-badge">🎯 ${escapeHtml(t("admin.job.targetBadge", { accepted, slots }))}</span>`
        : "";
      const quotaBar = slots > 0
        ? `
          <div class="job-row-quota">
            <div class="job-row-quota-bar" aria-hidden="true">
              ${hasQuota ? `<div class="job-row-quota-target" style="width:${acceptedPct ?? filledPct}%"></div>` : ""}
              ${hasQuota && accepted < slots ? `<div class="job-row-quota-rest" style="width:${100 - (acceptedPct ?? filledPct)}%"></div>` : ""}
              ${!hasQuota ? `<div class="job-row-quota-target" style="width:${filledPct}%; background: var(--color-primary, #059669);"></div>` : ""}
            </div>
            <span class="job-row-quota-text">
              ${hasTarget
                ? `<span class="quota-text-target"><strong>${accepted}</strong>/${slots}</span> · ${escapeHtml(t("admin.job.quotaText", { accepted, slots }))}`
                : hasQuota && accepted === slots
                  ? `Akan terima semua (<strong>${accepted}</strong>/${slots})`
                  : `${escapeHtml(t("admin.job.slotLeft", { available, slots }))}`
              }
              · ${escapeHtml(String(job.candidates || 0))} ${escapeHtml(t("quota.candidates"))}
            </span>
          </div>`
        : "";
      return `
        <div class="job-row ${isHidden ? "job-row-hidden" : ""}" data-job-id="${escapeHtml(job.id)}">
          <div class="job-row-info">
            <div class="job-row-company">
              ${escapeHtml(job.company.romaji)}${targetBadge}
              ${isHidden ? '<span class="hidden-badge">🔒 HIDDEN</span>' : ""}
            </div>
            <div class="job-row-meta">
              ${escapeHtml(job.industry)} · ${escapeHtml(job.location)} · ${escapeHtml(String(job.vacancies ?? slots))} ${escapeHtml(t("quota.slots"))}
              ${job.gender ? ` · <span class="gender-pill gender-${job.gender}">${
                job.gender === "male" ? "♂ " + t("job.gender.male") :
                job.gender === "female" ? "♀ " + t("job.gender.female") : "⚥ " + t("job.gender.all")
              }</span>` : ""}
              ${job.interview?.date ? ` · ${escapeHtml(t("modal.detail.interview"))} ${formatDate(job.interview.date)}` : ""}
            </div>
            ${quotaBar}
          </div>
          <div class="job-row-status">
            <span class="status-pill ${isOpen ? "open" : "closed"}">${escapeHtml(t(isOpen ? "job.status.open" : "job.status.closed"))}</span>
          </div>
          <div class="job-row-actions">
            <button class="btn btn-sm btn-edit" data-edit="${escapeHtml(job.id)}" type="button" title="Edit lowongan">✏ ${escapeHtml(t("admin.tabs.jobs").split(" ")[0] || "Edit")}</button>
            <button class="btn btn-sm ${isOpen ? "btn-warning" : "btn-success"}" data-toggle="${escapeHtml(job.id)}" data-open="${isOpen ? "true" : "false"}" type="button" title="${isOpen ? "Tutup lowongan (tidak terima pendaftar baru)" : "Buka lowongan"}">
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
      danger: true,
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
    list.innerHTML = skeletonHTML();
    try {
      jobsData = await api.getJobs({ includeHidden: true });
      render();
      window.dispatchEvent(new CustomEvent("admin:data-loaded", { detail: { source: "jobs", jobs: jobsData.jobs, openStatus: jobsData.openStatus } }));
    } catch (err) {
      list.innerHTML = emptyState("Gagal memuat lowongan", err.message || "");
    }
  }

  function getJobs() { return jobsData?.jobs || []; }
  function getOpenStatus() { return jobsData?.openStatus || {}; }

  return { load, render, getJobs, getOpenStatus };
}
