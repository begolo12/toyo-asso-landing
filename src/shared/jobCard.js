// Shared job card renderer.
// Single source of truth for how a job appears as a card.
// Used by:
//   - public landing page (src/site/jobs-view.js)
//   - admin form live preview (src/admin/forms.js)
//
// Depends only on dom.js (escapeHtml), format.js (formatYen, formatDate),
// jobs.js (slotStats, genderIcon), i18n.js (t). No admin/site-specific imports.

import { escapeHtml } from "./dom.js";
import { formatYen, formatDate } from "./format.js";
import { genderIcon, slotStats } from "./jobs.js";
import { t } from "./i18n.js";

function genderText(gender) {
  if (gender === "male") return t("job.gender.male");
  if (gender === "female") return t("job.gender.female");
  if (gender === "all") return t("job.gender.all");
  return "";
}

/**
 * Render a job card.
 *
 * @param {Object} job             Job data (must include company, industry, location, salary, interview, gender, slots/vacancies, candidates).
 * @param {Object} [opts]
 * @param {boolean} [opts.isOpen=true]    Whether the job is currently open for registration.
 * @param {boolean} [opts.preview=false]  When true, all action buttons get `data-preview="1"` and are non-interactive.
 * @param {boolean} [opts.hideActions=false] When true, omit the action buttons entirely.
 * @returns {string} HTML string for the job card.
 */
export function renderJobCard(job, opts = {}) {
  const { isOpen = true, preview = false, hideActions = false } = opts;
  const isHidden = Boolean(job.isHidden);
  const { slots, available, filledPct, accepted, acceptedPct } = slotStats(job);
  const isFull = slots > 0 && available === 0;

  // Status priority: closed (admin) > full (slots habis) > open
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

  const hasQuota = accepted != null && slots > 0;
  const candidates = Number(job.candidates || 0);
  const vacanciesText = `${escapeHtml(String(job.vacancies ?? slots))} (${escapeHtml(t("job.candidates"))} ${candidates})`;
  const slotLabelText = isFull ? t("job.slot.full") : t("job.slot", { available, slots });
  const showGender = job.gender === "male" || job.gender === "female" || job.gender === "all";
  const genderHtml = showGender
    ? ` <span class="job-gender-tag gender-${escapeHtml(job.gender)}">${genderIcon(job.gender)} ${escapeHtml(genderText(job.gender))}</span>`
    : "";

  // Show accepted row only when explicitly set AND it's a stricter quota than slots.
  // If accepted == slots, the slot bar already conveys the same info.
  const showAccepted = job.accepted != null && job.accepted < slots && slots > 0;

  // Slot bar fill: when accepted is set, show accepted portion (target).
  const slotFillPct = hasQuota ? (acceptedPct ?? filledPct) : filledPct;
  const slotFillClass = hasQuota ? "job-slot-fill has-quota" : "job-slot-fill";

  const interviewType = job.interview && job.interview.type
    ? (job.interview.type === "offline" ? t("job.interview.offline") : t("job.interview.online"))
    : t("job.interview.tba");
  const interviewDate = job.interview && job.interview.date ? formatDate(job.interview.date) : "";

  const btnDisabled = !isOpen || isFull;
  const btnLabel = !isOpen
    ? t("job.btn.closed")
    : (isFull ? t("job.btn.full") : t("job.btn.register"));

  const actionsHtml = hideActions ? "" : `
        <div class="job-card-actions">
          <button class="btn-detail" data-detail-job="${escapeHtml(job.id)}" data-preview="${preview ? "1" : ""}" aria-label="${escapeHtml(t("job.btn.detail.aria", { company: job.company.romaji }))}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Detail
          </button>
          <button class="btn-daftar" data-register-job="${escapeHtml(job.id)}" data-preview="${preview ? "1" : ""}" ${btnDisabled ? `disabled aria-disabled="true"` : ""} ${!isOpen ? `aria-label="${escapeHtml(t("job.btn.closed.aria"))}"` : ""}>
            ${btnLabel}
          </button>
        </div>
  `;

  return `
    <article class="job-card ${isOpen ? "" : "closed"} ${isFull ? "full" : ""} ${isHidden ? "job-card-hidden" : ""}" aria-labelledby="job-${escapeHtml(job.id)}-name">
      <div class="job-card-header">
        <div class="job-card-company">
          <div class="job-card-company-name">
            <div class="job-card-company-jp jp" id="job-${escapeHtml(job.id)}-name">${escapeHtml(job.company.jp)}</div>
            <div class="job-card-company-romaji">${escapeHtml(job.company.romaji)}</div>
          </div>
          <span class="job-status-badge ${statusClass}" aria-label="Status lowongan ${escapeHtml(statusLabel)}">${statusLabel}</span>
        </div>
        <div class="job-card-industry">
          ${escapeHtml(job.industry)}${genderHtml}
        </div>
        ${job.industryJp ? `<div class="job-card-industry-jp jp">${escapeHtml(job.industryJp)}</div>` : ""}
      </div>

      <div class="job-card-body">
        <div class="job-info-row">
          <span class="job-info-icon" aria-hidden="true">📍</span>
          <span class="job-info-label">${escapeHtml(t("job.location"))}</span>
          <span class="job-info-value">${escapeHtml(job.location || "—")}</span>
        </div>
        <div class="job-info-row">
          <span class="job-info-icon" aria-hidden="true">👥</span>
          <span class="job-info-label">${escapeHtml(t("job.looking"))}</span>
          <span class="job-info-value">${vacanciesText}</span>
        </div>
        ${showAccepted ? `
        <div class="job-info-row job-info-accepted">
          <span class="job-info-icon" aria-hidden="true">🎯</span>
          <span class="job-info-label">${escapeHtml(t("job.accepted.short"))}</span>
          <span class="job-info-value">
            <strong>${job.accepted}</strong> ${escapeHtml(t("job.accepted.of"))} ${slots}
          </span>
        </div>` : ""}

        <div class="job-salary">
          <div class="job-salary-row">
            <span class="job-salary-label">${escapeHtml(t("job.salary.gross"))}</span>
            <span class="job-salary-value">${formatYen(job.salary.gross)}${escapeHtml(t("job.salary.unit"))}</span>
          </div>
          <div class="job-salary-row">
            <span class="job-salary-label">${escapeHtml(t("job.salary.net"))}</span>
            <span class="job-salary-value job-salary-value-lg">${formatYen(job.salary.net)}${escapeHtml(t("job.salary.unit"))}</span>
          </div>
        </div>

        ${slots > 0 ? `
        <div class="job-slot" aria-label="${escapeHtml(slotLabelText)}">
          <div class="job-slot-info">
            <span class="job-slot-label">🎯 ${escapeHtml(slotLabelText)}</span>
            <span class="job-slot-value ${available === 0 ? "job-slot-full" : ""}">${available} / ${slots}</span>
          </div>
          <div class="job-slot-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${slots}" aria-valuenow="${slots - available}">
            <div class="${slotFillClass}" style="width: ${slotFillPct}%"></div>
          </div>
        </div>
        ` : ""}
      </div>

      <div class="job-card-footer">
        <div class="job-interview">
          <span>${interviewType}</span>
          ${interviewDate ? `<strong>${interviewDate}</strong>` : ""}
        </div>
        ${actionsHtml}
      </div>
    </article>
  `;
}
