import { escapeHtml } from "../shared/dom.js";
import { filterJobs } from "../shared/jobs.js";
import { renderJobCard } from "../shared/jobCard.js";
import { t } from "../shared/i18n.js";

export { renderJobCard };

export function renderJobsList(container, jobs, openStatus, currentFilter) {
  const filtered = filterJobs(jobs, currentFilter);
  if (filtered.length === 0) {
    const isFiltered = currentFilter !== "all" && jobs.length > 0;
    const filterLabel = currentFilter === "male" ? t("section.jobs.filter.male") : t("section.jobs.filter.female");
    container.innerHTML = `
      <div class="empty-state">
        <h3>${isFiltered ? `Tidak Ada Lowongan ${escapeHtml(filterLabel)}` : "Belum Ada Lowongan"}</h3>
        <p>${isFiltered ? "Coba filter lain atau cek kembali nanti." : "Saat ini belum ada lowongan yang dibuka. Silakan cek kembali nanti."}</p>
      </div>
    `;
    return;
  }
  container.innerHTML = filtered
    .map((job) => renderJobCard(job, { isOpen: openStatus[job.id] !== false }))
    .join("");
}

export function renderLoadingState(container) {
  container.innerHTML = `
    <div class="loading-state" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>${t("loading.jobs", "Memuat lowongan...")}</p>
    </div>
  `;
}

export function renderErrorState(container, onRetry) {
  container.innerHTML = `
    <div class="empty-state" role="alert">
      <h3>${t("error.title")}</h3>
      <p>${t("error.body")}</p>
      <div class="empty-action">
        <button class="btn-secondary" data-retry type="button">${t("error.retry")}</button>
      </div>
    </div>
  `;
  const btn = container.querySelector("[data-retry]");
  if (btn && typeof onRetry === "function") {
    btn.addEventListener("click", onRetry);
  }
}
