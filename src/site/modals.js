import { bindDialog, closeDialog, openDialog } from "../shared/a11y.js";
import { escapeHtml } from "../shared/dom.js";
import { formatDate, formatYen } from "../shared/format.js";
import { slotStats } from "../shared/jobs.js";
import { applyTranslations, t } from "../shared/i18n.js";
import { toast } from "../shared/toast.js";

export function createSiteModals({ getJobs, getOpenStatus, onSubmitRegistration }) {
  const registerModal = document.getElementById("registerModal");
  const detailModal = document.getElementById("detailModal");
  const detailDaftarBtn = document.getElementById("detailDaftarBtn");
  bindDialog(registerModal);
  bindDialog(detailModal);

  let currentRegisterJobId = null;
  let currentDetailJobId = null;

  function findJob(jobId) {
    return getJobs().find((j) => j.id === jobId);
  }

  function openRegister(jobId, triggerEl) {
    const job = findJob(jobId);
    if (!job) return;
    if (getOpenStatus()[jobId] === false) {
      toast({ message: t("toast.registration.closed"), type: "warning" });
      return;
    }
    currentRegisterJobId = jobId;
    const form = document.getElementById("registerForm");
    const successState = document.getElementById("successState");
    const formError = document.getElementById("formError");
    const submitBtn = document.getElementById("submitBtn");

    form.reset();
    form.classList.remove("hidden");
    successState.classList.add("hidden");
    formError.classList.add("hidden");
    formError.textContent = "";
    submitBtn.disabled = false;
    // Restore default submit label
    const labelEl = submitBtn.querySelector("[data-i18n]");
    if (labelEl) labelEl.textContent = t("modal.register.submit");
    else submitBtn.textContent = t("modal.register.submit");

    document.getElementById("jobId").value = jobId;
    const jobTitleEl = document.getElementById("modalJobTitle");
    jobTitleEl.innerHTML = `${t("modal.register.job.label")}: <strong>${escapeHtml(job.company.romaji)}</strong>`;
    openDialog(registerModal, triggerEl);
  }

  function openDetail(jobId, triggerEl) {
    const job = findJob(jobId);
    if (!job) return;
    currentDetailJobId = jobId;
    const titleEl = document.getElementById("detailTitle");
    if (titleEl) titleEl.textContent = job.company.jp;
    const romajiEl = document.getElementById("detailCompanyRomaji");
    if (romajiEl) romajiEl.textContent = job.company.romaji;
    document.getElementById("detailBody").innerHTML = renderDetailBody(job);

    const isOpen = getOpenStatus()[jobId] !== false;
    detailDaftarBtn.hidden = !isOpen;
    detailDaftarBtn.onclick = isOpen
      ? () => {
          closeDialog(detailModal);
          openRegister(jobId, detailDaftarBtn);
        }
      : null;
    openDialog(detailModal, triggerEl);
  }

  function refreshOpen() {
    // Re-apply translations to modals
    applyTranslations(registerModal);
    applyTranslations(detailModal);
    // Re-render currently open modals with fresh strings
    if (currentRegisterJobId && !registerModal.classList.contains("hidden")) {
      const job = findJob(currentRegisterJobId);
      if (job) {
        const jobTitleEl = document.getElementById("modalJobTitle");
        jobTitleEl.innerHTML = `${t("modal.register.job.label")}: <strong>${escapeHtml(job.company.romaji)}</strong>`;
      }
      const submitBtn = document.getElementById("submitBtn");
      const labelEl = submitBtn.querySelector("[data-i18n]");
      if (labelEl) labelEl.textContent = t("modal.register.submit");
    }
    if (currentDetailJobId && !detailModal.classList.contains("hidden")) {
      const job = findJob(currentDetailJobId);
      if (job) {
        document.getElementById("detailBody").innerHTML = renderDetailBody(job);
      }
    }
  }

  document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const submitBtn = document.getElementById("submitBtn");
    const formError = document.getElementById("formError");
    const formData = new FormData(form);
    const data = {
      jobId: formData.get("jobId"),
      name: formData.get("name")?.trim(),
      phone: formData.get("phone")?.trim(),
    };

    if (!data.name || data.name.length < 2) {
      showFormError(t("form.error.name.short"));
      return;
    }
    if (!data.phone || data.phone.replace(/\D/g, "").length < 8) {
      showFormError(t("form.error.phone.invalid"));
      return;
    }

    // Disable all form controls to prevent double-submit & signal busy state
    const allControls = form.querySelectorAll("input, select, textarea, button");
    allControls.forEach((el) => { el.disabled = true; });
    const labelEl = submitBtn.querySelector("[data-i18n]");
    if (labelEl) labelEl.textContent = t("modal.register.submitting");
    else submitBtn.textContent = t("modal.register.submitting");
    formError.classList.add("hidden");
    try {
      const result = await onSubmitRegistration(data);
      if (result.success) {
        form.classList.add("hidden");
        document.getElementById("successState").classList.remove("hidden");
        toast({ message: t("toast.registration.success"), type: "success" });
      } else {
        showFormError(result.error || t("modal.register.error.generic"));
        allControls.forEach((el) => { el.disabled = false; });
        if (labelEl) labelEl.textContent = t("modal.register.submit");
        else submitBtn.textContent = t("modal.register.submit");
      }
    } catch (err) {
      showFormError(t("modal.register.error.network"));
      allControls.forEach((el) => { el.disabled = false; });
      if (labelEl) labelEl.textContent = t("modal.register.submit");
      else submitBtn.textContent = t("modal.register.submit");
    }

    function showFormError(message) {
      formError.textContent = message;
      formError.classList.remove("hidden");
      formError.focus?.();
    }
  });

  return { openRegister, openDetail, refreshOpen };
}

function genderText(gender) {
  if (gender === "male") return t("job.gender.male");
  if (gender === "female") return t("job.gender.female");
  if (gender === "all") return t("job.gender.all");
  return "";
}

function renderDetailBody(job) {
  const salaryHourly = job.salary.grossHourly
    ? ` <span class="detail-value-sub">(${formatYen(job.salary.grossHourly)}${t("job.salary.unit") === "/bln" ? "/jam" : "/hr"})</span>`
    : "";
  const { slots, available, accepted } = slotStats(job);
  const vacanciesText = `${job.vacancies} (${t("job.candidates")} ${job.candidates || 0})`;

  const interviewType = job.interview && job.interview.type
    ? (job.interview.type === "offline" ? t("job.interview.offline") : t("job.interview.online"))
    : t("job.interview.tba");
  const interviewDate = job.interview && job.interview.date ? formatDate(job.interview.date) : "";
  const isFull = slots > 0 && available === 0;
  const showAccepted = accepted != null && accepted < slots && slots > 0;

  let html = `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">📋 ${t("modal.detail.industry")}</span>
        <span class="detail-value">${escapeHtml(job.industry)}${job.industryJp ? ` <span class="detail-value-sub jp">${escapeHtml(job.industryJp)}</span>` : ""}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">📍 ${t("job.location")}</span>
        <span class="detail-value">${escapeHtml(job.location)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">👥 ${t("job.looking")}</span>
        <span class="detail-value">${escapeHtml(vacanciesText)}</span>
      </div>
      ${showAccepted ? `
      <div class="detail-item detail-item-accepted">
        <span class="detail-label">🎯 ${t("job.accepted")}</span>
        <span class="detail-value detail-value-accepted">
          <strong>${accepted}</strong> ${t("job.accepted.of")} ${slots}
          <span class="detail-value-sub">(${t("job.accepted.ratio", { pct: Math.round((accepted / slots) * 100) })})</span>
        </span>
      </div>` : ""}
      <div class="detail-item">
        <span class="detail-label">👤 ${t("job.gender.male") === "Male" ? "Gender" : "Jenis Kelamin"}</span>
        <span class="detail-value">${escapeHtml(genderText(job.gender))}</span>
      </div>
      <div class="detail-item detail-item-salary">
        <span class="detail-label">💰 ${t("job.salary.gross")}</span>
        <span class="detail-value">${formatYen(job.salary.gross)}${t("job.salary.unit")}${salaryHourly}</span>
      </div>
      <div class="detail-item detail-item-salary">
        <span class="detail-label">💵 ${t("job.salary.net")}</span>
        <span class="detail-value detail-value-strong">${formatYen(job.salary.net)}${t("job.salary.unit")}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">📅 ${t("modal.detail.interview")}</span>
        <span class="detail-value">${interviewType}${interviewDate ? ` — <strong>${interviewDate}</strong>` : ""}</span>
      </div>
      ${
        slots > 0
          ? `<div class="detail-item">
              <span class="detail-label">🎯 ${t("job.slot", { available, slots })}</span>
              <span class="detail-value ${isFull ? "detail-value-full" : ""}">${available} / ${slots}${isFull ? ` · ${t("job.status.full")}` : ""}</span>
            </div>`
          : ""
      }
    </div>
  `;

  if (job.description) {
    html += `<div class="detail-section"><h3>${t("modal.detail.description", "Deskripsi Pekerjaan")}</h3><p>${escapeHtml(job.description)}</p></div>`;
  }
  if (Array.isArray(job.requirements) && job.requirements.length > 0) {
    html += `<div class="detail-section"><h3>${t("modal.detail.requirements")}</h3><ol class="detail-list">${job.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ol></div>`;
  }
  if (job.mensetsuNotes) {
    html += `<div class="detail-section detail-section-notes"><h3>⚠️ ${t("modal.detail.notes")}</h3><p>${escapeHtml(job.mensetsuNotes)}</p></div>`;
  }
  return html;
}
