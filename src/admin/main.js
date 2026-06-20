import { qs, qsa } from "../shared/dom.js";
import { initAuth } from "./auth.js";
import { createAdminApi } from "./api.js";
import { createApplicationsTable } from "./applications-table.js";
import { initExports } from "./export.js";
import { createJobForm } from "./forms.js";
import { createHistory } from "./history.js";
import { createJobsTable } from "./jobs-table.js";
import { createAdminState } from "./state.js";
import { confirmDialog, toast } from "../shared/toast.js";
import { applyTranslations, getLang, initI18n, setLang, t, subscribe as subscribeLang } from "../shared/i18n.js";
import { cycleTheme, getTheme, initTheme, subscribeTheme } from "../shared/theme.js";

const state = createAdminState();
const api = createAdminApi(state);

let jobsTable;
let applicationsTable;
let history;
let jobForm;
let lastDataLoadAt = null;
let refreshTimer = null;
// Aggregate counts across data-loaded events for badges/chip.
let lastJobsCount = 0;
let lastActiveJobsCount = 0;
let lastRegsCount = 0;

function initTabs() {
  const tabs = qs("#tablist");
  const tabButtons = tabs ? Array.from(tabs.querySelectorAll('[role="tab"]')) : [];
  function activate(target, opts = {}) {
    tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === target;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
      btn.classList.toggle("active", active);
    });
    qs("#tab-jobs").classList.toggle("active", target === "jobs");
    qs("#tab-registrations").classList.toggle("active", target === "registrations");
    qs("#tab-history").classList.toggle("active", target === "history");
    // Re-trigger fade animation by toggling display via class
    const panel = qs(`#tab-${target}`);
    if (panel) {
      panel.style.animation = "none";
      // Force reflow so animation restarts
      void panel.offsetWidth;
      panel.style.animation = "";
    }
    if (!opts.skipScroll) {
      // Smoothly scroll to the tab content top
      const main = qs(".dash-main");
      if (main) {
        const headerEl = qs(".dash-header");
        const offset = (headerEl?.offsetHeight || 0) + 8;
        const top = main.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }
    if (target === "registrations") applicationsTable.load();
    if (target === "history") history.load();
  }
  tabButtons.forEach((btn, idx) => {
    btn.addEventListener("click", () => activate(btn.dataset.tab));
    btn.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = e.key === "ArrowRight" ? (idx + 1) % tabButtons.length : (idx - 1 + tabButtons.length) % tabButtons.length;
      const nextBtn = tabButtons[next];
      nextBtn.focus();
      activate(nextBtn.dataset.tab);
      e.preventDefault();
    });
  });
}

function initReset() {
  const btn = qs("#btnResetRegs");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Hapus semua pendaftar?",
      message: "Semua pendaftar (pending/lolos/tidak lolos) akan dihapus permanen. Slot lowongan akan kembali ke penuh. Tindakan ini TIDAK bisa dibatalkan.",
      confirmText: "Hapus Permanen",
      cancelText: "Batal",
      danger: true,
    });
    if (!ok) return;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Menghapus...";
    try {
      await api.clearRegistrations();
      toast({ message: "Semua pendaftar telah dihapus. Slot lowongan di-reset.", type: "success" });
      await applicationsTable.load();
    } catch (err) {
      toast({ message: err.message || "Gagal menghapus data.", type: "error" });
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function formatRelative(d) {
  if (!d) return "";
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 5) return "baru saja";
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.round(hr / 24);
  return `${day} hari lalu`;
}

function ensureRefreshMeta() {
  let el = qs("#refreshMeta");
  if (el) return el;
  const toolbarRight = qs(".reg-toolbar-right");
  if (!toolbarRight) return null;
  el = document.createElement("span");
  el.id = "refreshMeta";
  el.className = "refresh-meta";
  el.innerHTML = `<span class="refresh-meta-dot" aria-hidden="true"></span><span class="refresh-meta-text">Memuat…</span>`;
  // Insert as first child of toolbar (before reset/refresh/export buttons)
  toolbarRight.insertBefore(el, toolbarRight.firstChild);
  return el;
}

function updateRefreshMeta() {
  const meta = ensureRefreshMeta();
  if (!meta) return;
  const text = meta.querySelector(".refresh-meta-text");
  if (!text) return;
  if (!lastDataLoadAt) {
    text.textContent = "Memuat…";
    meta.classList.remove("refreshing");
    return;
  }
  meta.classList.remove("refreshing");
  text.textContent = `Diperbarui ${formatRelative(lastDataLoadAt)}`;
  meta.setAttribute("title", lastDataLoadAt.toLocaleString("id-ID"));
}

function startRefreshTick() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(updateRefreshMeta, 15_000);
}

function updateTabBadges() {
  const jobsBadge = qs("#tabBadgeJobs");
  const regsBadge = qs("#tabBadgeRegs");
  if (jobsBadge) {
    const total = lastJobsCount;
    jobsBadge.textContent = String(total);
    jobsBadge.hidden = total === 0;
  }
  if (regsBadge) {
    const total = lastRegsCount;
    regsBadge.textContent = String(total);
    regsBadge.hidden = total === 0;
  }
}

function updateStatsChip() {
  const chipJobs = qs("#dashStatsJobs");
  const chipRegs = qs("#dashStatsRegs");
  if (chipJobs) chipJobs.textContent = String(lastActiveJobsCount);
  if (chipRegs) chipRegs.textContent = String(lastRegsCount);
}

function handleDataLoaded(event) {
  const detail = event?.detail || {};
  if (detail.source === "jobs" && Array.isArray(detail.jobs)) {
    lastJobsCount = detail.jobs.length;
    const openStatus = detail.openStatus || {};
    lastActiveJobsCount = detail.jobs.filter((j) => openStatus[j.id] !== false && !j.isHidden).length;
  }
  if (detail.source === "registrations" && typeof detail.count === "number") {
    lastRegsCount = detail.count;
  }
  updateTabBadges();
  updateStatsChip();
}

async function bootDashboard() {
  jobsTable = createJobsTable({ api, onEdit: (id) => jobForm.edit(id) });
  applicationsTable = createApplicationsTable({ api });
  history = createHistory({ api });
  jobForm = createJobForm({ api, jobsTable });

  applicationsTable.initFilters();
  initExports({
    getRows: () => applicationsTable.getFiltered(),
    getJobMap: () => applicationsTable.getJobMap(),
  });
  initReset();
  ensureRefreshMeta();
  initKeyboardShortcuts();
  initStatsChipClick();

  // Hook data-loaded events to update the indicator + badges + stats chip
  window.addEventListener("admin:data-loaded", handleDataLoaded);

  // Pre-mark as refreshing while initial loads run
  const meta = qs("#refreshMeta");
  if (meta) {
    meta.classList.add("refreshing");
    const text = meta.querySelector(".refresh-meta-text");
    if (text) text.textContent = "Memuat data…";
  }

  await jobsTable.load();
  // Mark loaded even if other tabs haven't been opened yet (so meta shows up)
  lastDataLoadAt = new Date();
  updateRefreshMeta();
  startRefreshTick();
}

function initStatsChipClick() {
  const chip = qs("#dashStatsChip");
  if (!chip) return;
  chip.setAttribute("tabindex", "0");
  chip.setAttribute("role", "button");
  const goToTab = (tabId) => {
    const tabBtn = qs(`[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.click();
  };
  chip.addEventListener("click", () => {
    // Clicking the chip's first half → jobs tab; clicking second half → registrations tab
    const rect = chip.getBoundingClientRect();
    const x = (event?.clientX ?? rect.left + rect.width / 2) - rect.left;
    goToTab(x < rect.width / 2 ? "jobs" : "registrations");
  });
  chip.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToTab("registrations");
    }
  });
}

function initKeyboardShortcuts() {
  // 'n' to open new job modal (when on jobs tab, no input focused)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "n" && e.key !== "N") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (target && (target.matches("input, textarea, select, [contenteditable]"))) return;
    const activeTab = qs(".tab.active")?.dataset?.tab;
    if (activeTab !== "jobs") return;
    if (!jobForm || typeof jobForm.edit !== "function") return;
    // Use the openCreate path indirectly via the button
    const createBtn = qs("#btnCreateJob");
    if (createBtn) createBtn.click();
  });
}

const auth = initAuth({
  state,
  api,
  onLogin: bootDashboard,
});

function initLangToggle() {
  const toggle = qs("#langToggle");
  if (!toggle) return;
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

function initThemeToggle() {
  const btn = qs("#themeToggle");
  if (!btn) return;
  const updateBtn = (theme) => {
    btn.dataset.themeState = theme;
    const labelKey = theme === "light" ? "theme.label.light" : theme === "dark" ? "theme.label.dark" : "theme.label.system";
    const label = t(labelKey);
    // data-i18n-aria handles aria-label automatically via applyTranslations.
    // We just need to refresh the title (which has dynamic state).
    btn.setAttribute("title", t("theme.toggle.title", { state: label }));
    btn.querySelectorAll(".theme-toggle-icon").forEach((el) => {
      el.classList.toggle("is-hidden", el.dataset.themeIcon !== theme);
    });
  };
  updateBtn(getTheme());
  btn.addEventListener("click", () => {
    cycleTheme();
  });
  subscribeTheme((theme) => updateBtn(theme));
}

function onLangChange() {
  const current = getLang();
  qsa("#langToggle button[data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.lang === current ? "true" : "false");
  });
  // Refresh theme toggle title (state-dependent string)
  const themeBtn = qs("#themeToggle");
  if (themeBtn) {
    const state = themeBtn.dataset.themeState || "system";
    const labelKey = state === "light" ? "theme.label.light" : state === "dark" ? "theme.label.dark" : "theme.label.system";
    themeBtn.setAttribute("title", t("theme.toggle.title", { state: t(labelKey) }));
  }
  applyTranslations(document);
  // Re-render admin tables with new language (they use static IDs/labels from JS)
  if (jobsTable && typeof jobsTable.load === "function") jobsTable.load();
  if (applicationsTable && typeof applicationsTable.load === "function") applicationsTable.load();
  if (history && typeof history.load === "function") history.load();
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initI18n(document);
  initLangToggle();
  initThemeToggle();
  subscribeLang(onLangChange);
  initTabs();
  auth.resume();
});
