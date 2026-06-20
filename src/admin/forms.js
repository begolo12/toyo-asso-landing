import { bindDialog, closeDialog, openDialog } from "../shared/a11y.js";
import { debounce, qs, qsa } from "../shared/dom.js";
import { confirmDialog, toast } from "../shared/toast.js";
import { renderJobCard } from "../shared/jobCard.js";
import { applyTranslations, t } from "../shared/i18n.js";

// Required fields by name. Order matters: it's the order shown in the summary banner.
const REQUIRED_FIELDS = [
  "id",
  "slots",
  "companyRomaji",
  "companyJp",
  "industry",
  "location",
  "gender",
  "salaryGross",
  "salaryNet",
  "interviewDate",
  "interviewType",
];

export function createJobForm({ api, jobsTable }) {
  const modal = qs("#createJobModal");
  const form = qs("#createJobForm");
  const errorEl = qs("#createJobError");
  const submitBtn = qs("#createJobSubmitBtn");
  const openBtn = qs("#btnCreateJob");
  const title = qs("#createJobModalTitle");
  const quotaToggle = qs("#quotaToggle");
  const quotaToggleLabel = qs("#quotaToggleLabel");
  const acceptedField = qs(".quota-accepted-field");
  const acceptedInput = qs('input[name="accepted"]');
  const acceptedError = qs("#acceptedError");
  // form.id is the form's id attribute (string), so we need a direct ref
  // to the input with name="id" (named access would collide with the IDL attr).
  const idInput = qs('input[name="id"]', form);
  const quotaSlotsText = qs("#quotaSlotsText");
  const quotaCandidatesText = qs("#quotaCandidatesText");
  const quotaAcceptedSummary = qs("#quotaAcceptedSummary");
  const previewCard = qs("#formPreviewCard");
  const requiredSummary = qs("#formRequiredSummary");
  const requiredCount = qs("#formRequiredCount");
  const requiredList = qs("#formRequiredList");
  const stepperItems = Array.from(modal.querySelectorAll(".form-stepper-item"));
  const sections = Array.from(modal.querySelectorAll(".form-section"));

  let dirty = false;
  let acceptedMode = "auto"; // "auto" | "manual"
  let isEdit = false;

  bindDialog(modal);

  // ----- Dirty tracking -----
  form.addEventListener("input", () => {
    if (!dirty) dirty = true;
    updatePreview();
    updateQuotaSummary();
    updateAcceptedValidation();
	scheduleRequiredSummary();
  });
  form.addEventListener("change", () => {
    if (!dirty) dirty = true;
    updatePreview();
    updateQuotaSummary();
    updateAcceptedValidation();
    scheduleRequiredSummary();
  });

  // ----- Reset form -----
  function resetForm() {
    form.reset();
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-saving", "is-error");
    submitBtn.textContent = t("admin.form.save");
    title.textContent = t("admin.form.title.create");
    qs("#editId").value = "";
    idInput.disabled = false;
    // Defensive: re-enable any controls left disabled from a prior save
    // (the submit handler disables everything before await; if the modal
    // is reopened we must restore them so the form is editable).
    qsa("input, select, textarea, button", modal).forEach((el) => { el.disabled = false; });
    dirty = false;
    isEdit = false;
    setAcceptedMode("auto", { silent: true });
    updatePreview();
    updateQuotaSummary();
    updateRequiredSummary();
    updateStepper(1);
  }

  function openCreate(triggerEl) {
    resetForm();
    openDialog(modal, triggerEl);
    setTimeout(() => idInput?.focus(), 80);
  }

  async function requestClose() {
    if (dirty) {
      const ok = await confirmDialog({
        title: "Tutup form?",
        message: "Perubahan yang belum disimpan akan hilang.",
        confirmText: "Tutup",
        cancelText: "Lanjut Edit",
      });
      if (!ok) return;
    }
    dirty = false;
    closeDialog(modal);
  }

  modal.addEventListener("dialog:close", (e) => {
    e.stopImmediatePropagation();
    requestClose();
  });
  modal.querySelectorAll("[data-close-dialog], [data-close-create-job]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    }, true);
  });
  openBtn.addEventListener("click", () => openCreate(openBtn));

  // ----- Quota toggle (auto / manual) -----
  quotaToggle.addEventListener("click", () => {
    const next = acceptedMode === "auto" ? "manual" : "auto";
    setAcceptedMode(next);
    dirty = true;
    updatePreview();
    updateQuotaSummary();
  });

  function setAcceptedMode(mode, { silent = false } = {}) {
    acceptedMode = mode;
    quotaToggle.dataset.mode = mode;
    quotaToggle.setAttribute("aria-pressed", mode === "manual" ? "false" : "true");
    quotaToggleLabel.textContent = mode === "manual" ? t("admin.form.quota.manual") : t("admin.form.quota.auto");
    if (mode === "manual") {
      acceptedField.hidden = false;
      acceptedField.setAttribute("aria-hidden", "false");
    } else {
      acceptedField.hidden = true;
      acceptedField.setAttribute("aria-hidden", "true");
      acceptedInput.value = "";
      acceptedError.hidden = true;
      acceptedError.textContent = "";
      acceptedInput.closest(".form-field")?.classList.remove("is-invalid");
    }
    if (!silent) {
      if (mode === "manual") {
        setTimeout(() => acceptedInput.focus(), 80);
      }
    }
  }

  // ----- Live quota summary -----
  function updateQuotaSummary() {
    const slots = Number(form.slots?.value || 0);
    const candidates = Number(form.candidates?.value || 0);
    const acceptedRaw = Number(acceptedInput?.value);
    const accepted = Number.isFinite(acceptedRaw) && acceptedRaw >= 0 ? Math.floor(acceptedRaw) : null;

    quotaSlotsText.textContent = String(slots || 0);
    quotaCandidatesText.textContent = String(candidates || 0);

    if (accepted != null && slots > 0) {
      const pct = Math.round((accepted / slots) * 100);
      if (accepted === slots) {
        quotaAcceptedSummary.innerHTML = t("admin.form.accepted.equalSlots", { accepted, slots });
      } else if (accepted === 0) {
        quotaAcceptedSummary.innerHTML = `<strong>0</strong> · <span class="form-field-help-text">${escapeText(t("admin.form.accepted.zero"))}</span>`;
      } else {
        quotaAcceptedSummary.innerHTML = t("admin.form.accepted.summary", { accepted, pct });
      }
      quotaAcceptedSummary.hidden = false;
    } else {
      quotaAcceptedSummary.hidden = true;
      quotaAcceptedSummary.innerHTML = "";
    }
  }

  function updateAcceptedValidation() {
    if (acceptedMode !== "manual") return;
    const slots = Number(form.slots?.value || 0);
    const acceptedRaw = acceptedInput.value.trim();
    if (acceptedRaw === "") {
      acceptedError.hidden = true;
      acceptedError.textContent = "";
      acceptedInput.closest(".form-field")?.classList.remove("is-invalid");
      return;
    }
    const a = Number(acceptedRaw);
    if (!Number.isFinite(a) || a < 0) {
      acceptedError.textContent = t("admin.form.accepted.error.negative");
      acceptedError.hidden = false;
      acceptedInput.closest(".form-field")?.classList.add("is-invalid");
      return;
    }
    if (slots > 0 && a > slots) {
      acceptedError.textContent = t("admin.form.accepted.error.exceeds", { max: slots });
      acceptedError.hidden = false;
      acceptedInput.closest(".form-field")?.classList.add("is-invalid");
      return;
    }
    acceptedError.hidden = true;
    acceptedError.textContent = "";
    acceptedInput.closest(".form-field")?.classList.remove("is-invalid");
  }

  function isAcceptedValid() {
    if (acceptedMode !== "manual") return true;
    const slots = Number(form.slots?.value || 0);
    const acceptedRaw = acceptedInput.value.trim();
    if (acceptedRaw === "") return true; // empty allowed (back-compat: null)
    const a = Number(acceptedRaw);
    if (!Number.isFinite(a) || a < 0) return false;
    if (slots > 0 && a > slots) return false;
    return true;
  }

  // ----- Required-field summary -----
  const scheduleRequiredSummary = debounce(updateRequiredSummary, 220);

  function updateRequiredSummary() {
    const missing = REQUIRED_FIELDS.filter((name) => {
      const el = form.elements[name];
      if (!el) return false;
      const v = (el.value ?? "").toString().trim();
      return !v;
    });
    if (missing.length === 0) {
      requiredSummary.hidden = true;
      return;
    }
    requiredCount.textContent = String(missing.length);
    requiredList.innerHTML = missing
      .map((name) => {
        const label = fieldLabel(name);
        const el = form.elements[name];
        if (!el) return "";
        const id = el.closest(".form-field")?.id || `field-${name}`;
        return `<a href="#${id}" data-required-jump="${escapeText(name)}">${escapeText(label)}</a>`;
      })
      .join("");
    requiredSummary.hidden = false;
  }

  requiredList.addEventListener("click", (e) => {
    const a = e.target.closest("[data-required-jump]");
    if (!a) return;
    e.preventDefault();
    const name = a.dataset.requiredJump;
    const el = form.elements[name];
    if (!el) return;
    const wrapper = el.closest(".form-field");
    if (!wrapper) return;
    wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
    wrapper.classList.add("is-highlighted");
    setTimeout(() => wrapper.classList.remove("is-highlighted"), 800);
    setTimeout(() => el.focus({ preventScroll: true }), 200);
  });

  function fieldLabel(name) {
    // Read the visible label text from the form-field wrapper, excluding
    // the req-mark (* wajib) and opt-mark (opsional) indicators.
    const el = form.elements[name];
    const wrapper = el?.closest(".form-field");
    if (!wrapper) return name;
    const labelEl = wrapper.querySelector(".form-field-label");
    if (!labelEl) return name;
    const clone = labelEl.cloneNode(true);
    clone.querySelectorAll(".req-mark, .opt-mark").forEach((m) => m.remove());
    return (clone.textContent || "").trim() || name;
  }

  // ----- Stepper (scroll-spy + click to scroll) -----
  function updateStepper(activeStep) {
    stepperItems.forEach((item) => {
      const step = Number(item.dataset.step);
      item.classList.toggle("is-active", step === activeStep);
      item.classList.toggle("is-done", step < activeStep);
    });
  }

  stepperItems.forEach((item) => {
    item.addEventListener("click", () => {
      const step = Number(item.dataset.step);
      const target = modal.querySelector(`.form-section[data-step="${step}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that's most visible
        let best = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        }
        if (best) {
          const step = Number(best.target.dataset.step);
          if (step) updateStepper(step);
        }
      },
      { root: modal.querySelector(".create-job-form"), threshold: [0.2, 0.6] }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // ----- Live preview -----
  const updatePreview = debounce(() => {
    const job = jobFromFormPartial();
    const html = renderJobCard(job, { isOpen: true, preview: true });
    previewCard.innerHTML = html;
  }, 120);

  // ----- Form → job conversion -----
  function jobFromFormPartial() {
    const fd = new FormData(form);
    const get = (key) => (fd.get(key) ?? "").toString();
    const slots = Number(get("slots")) || 0;
    const candidates = Number(get("candidates")) || 0;
    const acceptedRaw = get("accepted");
    const accepted = acceptedMode === "manual" && acceptedRaw.trim() !== ""
      ? Math.floor(Number(acceptedRaw))
      : null;
    return {
      id: get("id") || "preview",
      company: {
        jp: get("companyJp") || "—",
        romaji: get("companyRomaji") || "—",
      },
      industry: get("industry") || "—",
      industryJp: get("industryJp") || "",
      location: get("location") || "—",
      gender: get("gender") || "all",
      slots,
      vacancies: slots,
      candidates,
      accepted,
      salary: {
        gross: Number(get("salaryGross")) || 0,
        grossHourly: Number(get("salaryHourly")) || null,
        net: Number(get("salaryNet")) || 0,
      },
      interview: {
        date: get("interviewDate") || "2026-12-31",
        type: get("interviewType") || "offline",
      },
      description: get("description") || "",
      requirements: (get("requirements") || "").split("\n").map(s => s.trim()).filter(Boolean),
      mensetsuNotes: get("mensetsuNotes") || "",
      isHidden: false,
    };
  }

  function jobFromForm() {
    const fd = new FormData(form);
    const requirementsText = (fd.get("requirements") || "").toString().trim();
    const requirements = requirementsText
      ? requirementsText.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
    const acceptedRaw = (fd.get("accepted") ?? "").toString().trim();
    const accepted = acceptedMode === "manual" && acceptedRaw !== ""
      ? Math.floor(Number(acceptedRaw))
      : null;
    return {
      id: (fd.get("id") || "").toString().trim(),
      gender: (fd.get("gender") || "all").toString(),
      slots: Number(fd.get("slots") || 0),
      company: {
        jp: (fd.get("companyJp") || "").toString().trim(),
        romaji: (fd.get("companyRomaji") || "").toString().trim(),
      },
      industry: (fd.get("industry") || "").toString().trim(),
      industryJp: (fd.get("industryJp") || "").toString().trim(),
      location: (fd.get("location") || "").toString().trim(),
      vacancies: Number(fd.get("slots") || 0),
      candidates: fd.get("candidates") ? Number(fd.get("candidates")) : 0,
      accepted,
      salary: {
        gross: Number(fd.get("salaryGross")),
        grossHourly: fd.get("salaryHourly") ? Number(fd.get("salaryHourly")) : null,
        net: Number(fd.get("salaryNet")),
      },
      interview: {
        date: fd.get("interviewDate"),
        type: fd.get("interviewType"),
      },
      description: (fd.get("description") || "").toString().trim(),
      requirements,
      mensetsuNotes: (fd.get("mensetsuNotes") || "").toString().trim(),
    };
  }

  // ----- Submit -----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    // Validate accepted (if in manual mode) — block submit if invalid
    if (!isAcceptedValid()) {
      updateAcceptedValidation();
      acceptedField.scrollIntoView({ behavior: "smooth", block: "center" });
      acceptedInput.focus();
      return;
    }

    const editId = qs("#editId").value;
    const job = jobFromForm();
    if (editId) job.id = editId;

    // Disable all form controls during submit
    const allControls = modal.querySelectorAll("input, select, textarea, button");
    allControls.forEach((el) => { el.disabled = true; });
    submitBtn.classList.add("is-saving");
    submitBtn.textContent = editId ? t("admin.form.save.saving.edit") : t("admin.form.save.saving");
    try {
      const result = await api.saveJob(job, editId);
      dirty = false;
      // Re-enable ALL controls BEFORE closing — otherwise the form stays
      // disabled the next time the user opens it (for edit or new job).
      allControls.forEach((el) => { el.disabled = false; });
      submitBtn.classList.remove("is-saving");
      submitBtn.textContent = editId ? t("admin.form.save.edit") : t("admin.form.save");
      closeDialog(modal);
      await jobsTable.load();
      toast({ message: `Lowongan "${result.job.company.romaji}" ${editId ? "diperbarui" : "ditambahkan"}.`, type: "success" });
    } catch (err) {
      errorEl.textContent = err.message || "Gagal menyimpan lowongan";
      errorEl.classList.remove("hidden");
      submitBtn.classList.remove("is-saving");
      submitBtn.classList.add("is-error");
      setTimeout(() => submitBtn.classList.remove("is-error"), 400);
      allControls.forEach((el) => { el.disabled = false; });
      submitBtn.textContent = editId ? t("admin.form.save.edit") : t("admin.form.save");
    }
  });

  // ----- Edit (restore from existing job) -----
  function edit(jobId) {
    const job = jobsTable.getJobs().find((item) => item.id === jobId);
    if (!job) {
      toast({ message: "Job tidak ditemukan.", type: "error" });
      return;
    }
    resetForm();
    isEdit = true;
    title.textContent = t("admin.form.title.edit");
    qs("#editId").value = jobId;
    idInput.value = jobId;
    idInput.disabled = true;
    form.companyRomaji.value = job.company.romaji || "";
    form.companyJp.value = job.company.jp || "";
    form.industry.value = job.industry || "";
    form.industryJp.value = job.industryJp || "";
    form.location.value = job.location || "";
    form.slots.value = job.slots || job.vacancies || "";
    form.gender.value = job.gender || "all";
    form.candidates.value = job.candidates || "";
    if (job.accepted != null && Number.isFinite(Number(job.accepted))) {
      setAcceptedMode("manual", { silent: true });
      form.accepted.value = String(job.accepted);
    }
    form.salaryGross.value = job.salary?.gross || "";
    form.salaryHourly.value = job.salary?.grossHourly || "";
    form.salaryNet.value = job.salary?.net || "";
    form.interviewDate.value = job.interview?.date || "";
    form.interviewType.value = job.interview?.type || "offline";
    form.description.value = job.description || "";
    form.requirements.value = (job.requirements || []).join("\n");
    form.mensetsuNotes.value = job.mensetsuNotes || "";
    submitBtn.textContent = t("admin.form.save.edit");
    dirty = false;
    updatePreview();
    updateQuotaSummary();
    updateAcceptedValidation();
    updateRequiredSummary();
    openDialog(modal, qs(`[data-edit="${jobId}"]`));
    // Re-apply translations (modal labels use data-i18n)
    applyTranslations(modal);
  }

  return { edit };
}

// Helper: minimal HTML escape for inline text in summary banner etc.
function escapeText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
