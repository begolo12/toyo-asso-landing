// ============================================
// Theme toggle (light / dark / system)
// Persists user preference to localStorage and
// applies it via data-theme on <html>. System
// mode follows prefers-color-scheme. Listeners
// are notified on changes so language toggle
// labels can update.
// ============================================

const STORAGE_KEY = "lpkpjb.theme";
const VALID = new Set(["light", "dark", "system"]);

const subscribers = new Set();

let current = readStored();

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (VALID.has(stored)) return stored;
  } catch {
    /* localStorage may be blocked */
  }
  return "system";
}

function persist(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/**
 * Apply theme to <html>.
 * `system` defers to prefers-color-scheme (no data-theme attr).
 * `light`/`dark` sets data-theme explicitly.
 */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
  // Toggle color-scheme so native form controls + scrollbars match.
  root.style.colorScheme = theme === "system" ? "light dark" : theme;
}

function notify(theme) {
  for (const fn of subscribers) {
    try { fn(theme); } catch (err) { console.error("theme subscriber error:", err); }
  }
}

/** Get the effective resolved theme: "light" or "dark". */
export function resolvedTheme() {
  if (current === "system") {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return current;
}

export function getTheme() {
  return current;
}

export function setTheme(theme) {
  if (!VALID.has(theme)) return;
  if (theme === current) return;
  current = theme;
  persist(theme);
  applyTheme(theme);
  notify(theme);
}

export function cycleTheme() {
  // Light → Dark → System → Light
  const next = current === "light" ? "dark" : current === "dark" ? "system" : "light";
  setTheme(next);
  return next;
}

export function subscribeTheme(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Init: apply stored theme + listen to OS scheme changes. */
export function initTheme() {
  applyTheme(current);
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (current === "system") notify("system");
    };
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }
}
