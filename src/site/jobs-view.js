import { escapeHtml } from "../shared/dom.js";
import { formatDate, formatYen } from "../shared/format.js";
import { filterJobs, genderIcon, slotStats } from "../shared/jobs.js";
import { t } from "../shared/i18n.js";

function genderText(gender) {
  if (gender === "male") return t("job.gender.male");
  if (gender === "female") return t("job.gender.female");
  if (gender === "all") return t("job.gender.all");
  return "";
}

export function renderJobCard(job, openStatus) {
  const isOpen = openStatus[job.id] !== false;
  const isHidden = Boolean(job.isHidden);
  const { slots, available, filledPct } = slotStats(job);
  const isFull = slots > 0 && available === 0;
  const gender = job.gender;
  const showGender = gender === "male" || gender === "female";
  const candidates = job.candidates || 0;
  const vacanciesText = `${escapeHtml(String(job.vacancies ?? slots))} (${t("job.candidates")} ${candidates})`;

  // Status: DITUTUP (admin closed) > PENUH (slots habis) > DIBUKA
  let statusLabel, statusClass;
  if (!isOpen) {
    statusLabel = t("job.status.closed");
    statusClass = "closed";
  } else if (isFull) {
    statusLabel = t("job.status.full");
    statusClass = "full";
  } else {
    statusLabel = t("job.status.open");
    statusClass = "open";
  }

  const slotLabelText = isFull ? t("job.slot.full") : t("job.slot", { available, slots });
  const genderHtml = showGender || gender === "all"
    ? ` <span class="job-gender-tag gender-${escapeHtml(gender)}">${genderIcon(gender)} ${escapeHtml(genderText(gender))}</span>`
    : "";
  const interviewType = job.interview && job.interview.type
    ? (job.interview.type === "offline" ? t("job.interview.offline") : t("job.interview.online"))
    : t("job.interview.tba");
  const interviewDate = job.interview && job.interview.date ? formatDate(job.interview.date) : "";

  return `
    <article class="job-card ${isOpen ? "" : "closed"} ${isFull ? "full" : ""} ${isHidden ? "job-card-hidden" : ""}" aria-labelledby="job-${escapeHtml(job.id)}-name">
      <div class="job-card-header">
        <div class="job-card-company">
          <div class="job-card-company-name">
            <div class="job-card-company-jp jp" id="job-${escapeHtml(job.id)}-name">${escapeHtml(job.company.jp)}</div>
            <div class="job-card-company-romaji">${escapeHtml(job.company.romaji)}</div>
          </div>
          <span class="job-status-badge ${statusClass}" aria-label="Status lowongan ${statusLabel}">${statusLabel}</span>
        </div>
        <div class="job-card-industry">
          ${escapeHtml(job.industry)}${genderHtml}
        </div>
        ${job.industryJp ? `<div class="job-card-industry-jp jp">${escapeHtml(job.industryJp)}</div>` : ""}
      </div>

      <div class="job-card-body">
        <div class="job-info-row">
          <span class="job-info-icon" aria-hidden="true">📍</span>
          <span class="job-info-label">${t("job.location")}</span>
          <span class="job-info-value">${escapeHtml(job.location || "—")}</span>
        </div>
        <div class="job-info-row">
          <span class="job-info-icon" aria-hidden="true">👥</span>
          <span class="job-info-label">${t("job.looking")}</span>
          <span class="job-info-value">${vacanciesText}</span>
        </div>

        <div class="job-salary">
          <div class="job-salary-row">
            <span class="job-salary-label">${t("job.salary.gross")}</span>
            <span class="job-salary-value">${formatYen(job.salary.gross)}${t("job.salary.unit")}</span>
          </div>
          <div class="job-salary-row">
            <span class="job-salary-label">${t("job.salary.net")}</span>
            <span class="job-salary-value job-salary-value-lg">${formatYen(job.salary.net)}${t("job.salary.unit")}</span>
          </div>
        </div>

        ${
          slots > 0
            ? `
        <div class="job-slot" aria-label="${slotLabelText}">
          <div class="job-slot-info">
            <span class="job-slot-label">🎯 ${slotLabelText}</span>
            <span class="job-slot-value ${available === 0 ? "job-slot-full" : ""}">${available} / ${slots}</span>
          </div>
          <div class="job-slot-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${slots}" aria-valuenow="${slots - available}">
            <div class="job-slot-fill" style="width: ${filledPct}%"></div>
          </div>
        </div>
        `
            : ""
        }
      </div>

      <div class="job-card-footer">
        <div class="job-interview">
          <span>${interviewType}</span>
          ${interviewDate ? `<strong>${interviewDate}</strong>` : ""}
        </div>
        <div class="job-card-actions">
          <button class="btn-detail" data-detail-job="${escapeHtml(job.id)}" aria-label="${t("job.btn.detail.aria", { company: job.company.romaji })}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            ${t("job.btn.detail", { company: "" }).trim() || "Detail"}
          </button>
          <button class="btn-daftar" data-register-job="${escapeHtml(job.id)}" ${isOpen && !isFull ? "" : "disabled aria-disabled=\"true\""}>
            ${isFull && isOpen ? t("job.btn.full") : isOpen ? t("job.btn.register") : t("job.btn.closed")}
          </button>
        </div>
      </div>
    </article>
  `;
}

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
  container.innerHTML = filtered.map((job) => renderJobCard(job, openStatus)).join("");
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
