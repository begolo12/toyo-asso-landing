import { qs, qsa } from "../shared/dom.js";
import { normalizeJobs } from "../shared/jobs.js";
import { renderErrorState, renderJobsList, renderLoadingState } from "./jobs-view.js";
import { createSiteModals } from "./modals.js";
import { applyTranslations, getLang, initI18n, setLang, t, subscribe as subscribeLang } from "../shared/i18n.js";

const JOBS_API = "/api/jobs";
const REGISTER_API = "/api/register";

let jobs = [];
let openStatus = {};
let currentFilter = "all";
let modals = null;

async function fetchJobs() {
  const res = await fetch(JOBS_API, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Failed to load jobs");
  return res.json();
}

async function submitRegistration(data) {
  const res = await fetch(REGISTER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: result.error || t("modal.register.error.generic") };
  return result;
}

function updateJobCount() {
  const countEl = qs("#jobsCount");
  if (!countEl) return;
  const openCount = jobs.filter((job) => openStatus[job.id] !== false).length;
  if (jobs.length === 0) {
    countEl.textContent = t("section.jobs.count.empty");
  } else {
    countEl.textContent = t("section.jobs.count.open", { open: openCount, total: jobs.length });
  }
  const heroStatJobs = qs("#heroStatJobs");
  if (heroStatJobs) heroStatJobs.textContent = String(openCount);
}

function render() {
  const container = qs("#jobsContainer");
  if (!container) return;
  updateJobCount();
  renderJobsList(container, jobs, openStatus, currentFilter);
}

async function loadJobs() {
  const container = qs("#jobsContainer");
  if (!container) return;
  renderLoadingState(container);
  try {
    const data = await fetchJobs();
    jobs = normalizeJobs(data.jobs || []);
    openStatus = data.openStatus || {};
    render();
  } catch (err) {
    console.error("Error loading jobs:", err);
    qs("#jobsCount").textContent = "";
    renderErrorState(container, loadJobs);
  }
}

function initFilters() {
  qsa("#filterBar .filter-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false");
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter || "all";
      qsa("#filterBar .filter-btn").forEach((item) => {
        const active = item === btn;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });
      render();
    });
  });
}

function initJobActions() {
  qs("#jobsContainer")?.addEventListener("click", (e) => {
    const detailBtn = e.target.closest("[data-detail-job]");
    if (detailBtn) {
      modals.openDetail(detailBtn.dataset.detailJob, detailBtn);
      return;
    }
    const registerBtn = e.target.closest("[data-register-job]");
    if (registerBtn) {
      modals.openRegister(registerBtn.dataset.registerJob, registerBtn);
    }
  });
}

function initLangToggle() {
  const toggle = qs("#langToggle");
  if (!toggle) return;
  // Reflect current state
  const current = getLang();
  qsa("#langToggle button[data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.lang === current ? "true" : "false");
  });
  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lang]");
    if (!btn) return;
    setLang(btn.dataset.lang);
  });
}

function onLangChange() {
  // Reflect new state in toggle buttons
  const current = getLang();
  qsa("#langToggle button[data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.lang === current ? "true" : "false");
  });
  // Re-translate static markup
  applyTranslations(document);
  // Re-render dynamic content
  if (jobs.length > 0 || qs("#jobsContainer .empty-state, #jobsContainer .job-card")) {
    render();
  } else {
    updateJobCount();
  }
  // Re-render any open modal
  if (modals && typeof modals.refreshOpen === "function") {
    modals.refreshOpen();
  }
  // Re-fill footer year if changed
  const yearEl = qs("#footerYear");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function init() {
  initI18n(document);
  initLangToggle();
  subscribeLang(onLangChange);

  modals = createSiteModals({
    getJobs: () => jobs,
    getOpenStatus: () => openStatus,
    onSubmitRegistration: submitRegistration,
  });
  initFilters();
  initJobActions();
  loadJobs();
  const yearEl = qs("#footerYear");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", init);
