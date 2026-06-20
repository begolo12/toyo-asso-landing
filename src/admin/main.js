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
import { applyTranslations, getLang, initI18n, setLang, subscribe as subscribeLang } from "../shared/i18n.js";

const state = createAdminState();
const api = createAdminApi(state);

let jobsTable;
let applicationsTable;
let history;
let jobForm;

function initTabs() {
  const tabs = qs("#tablist");
  const tabButtons = tabs ? Array.from(tabs.querySelectorAll('[role="tab"]')) : [];
  function activate(target) {
    tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === target;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
      btn.classList.toggle("active", active);
    });
    qs("#tab-jobs").classList.toggle("active", target === "jobs");
    qs("#tab-registrations").classList.toggle("active", target === "registrations");
    qs("#tab-history").classList.toggle("active", target === "history");
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
  await jobsTable.load();
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

function onLangChange() {
  const current = getLang();
  qsa("#langToggle button[data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.lang === current ? "true" : "false");
  });
  applyTranslations(document);
  // Re-render admin tables with new language (they use static IDs/labels from JS)
  if (jobsTable && typeof jobsTable.load === "function") jobsTable.load();
  if (applicationsTable && typeof applicationsTable.load === "function") applicationsTable.load();
  if (history && typeof history.load === "function") history.load();
}

document.addEventListener("DOMContentLoaded", () => {
  initI18n(document);
  initLangToggle();
  subscribeLang(onLangChange);
  initTabs();
  auth.resume();
});
