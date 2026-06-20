import { qs, qsa } from "./dom.js";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let activeDialog = null;
let savedFocus = null;
let savedOverflow = "";

function trapKeydown(e) {
  if (!activeDialog) return;
  if (e.key === "Escape") {
    e.preventDefault();
    activeDialog.dispatchEvent(new CustomEvent("dialog:close", { bubbles: true }));
    return;
  }
  if (e.key !== "Tab") return;
  const focusables = qsa(FOCUSABLE_SELECTOR, activeDialog).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
  if (focusables.length === 0) {
    e.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

export function openDialog(dialogEl, openerEl) {
  if (!dialogEl) return;
  if (activeDialog && activeDialog !== dialogEl) {
    closeDialog(activeDialog);
  }
  activeDialog = dialogEl;
  savedFocus = openerEl || document.activeElement;
  savedOverflow = document.body.style.overflow;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  dialogEl.classList.remove("hidden");
  dialogEl.setAttribute("aria-hidden", "false");
  dialogEl.setAttribute("aria-modal", "true");
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  requestAnimationFrame(() => {
    const target =
      qs("[data-autofocus]", dialogEl) || qs(FOCUSABLE_SELECTOR, dialogEl);
    if (target) target.focus();
  });
}

export function closeDialog(dialogEl) {
  if (!dialogEl) return;
  dialogEl.classList.add("hidden");
  dialogEl.setAttribute("aria-hidden", "true");
  dialogEl.removeAttribute("aria-modal");
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = "";
  if (activeDialog === dialogEl) {
    activeDialog = null;
  }
  if (savedFocus && typeof savedFocus.focus === "function") {
    requestAnimationFrame(() => savedFocus.focus());
  }
  savedFocus = null;
}

export function bindDialog(dialogEl) {
  if (!dialogEl) return;
  qsa("[data-close-dialog]", dialogEl).forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeDialog(dialogEl);
    });
  });
  dialogEl.addEventListener("click", (e) => {
    if (e.target === dialogEl || e.target.classList.contains("modal-overlay")) {
      e.stopPropagation();
      dialogEl.dispatchEvent(new CustomEvent("dialog:close", { bubbles: true }));
    }
  });
  dialogEl.addEventListener("dialog:close", () => closeDialog(dialogEl));
}

document.addEventListener("keydown", trapKeydown);

export function announce(message, polite = true) {
  const el = document.createElement("div");
  el.setAttribute("role", polite ? "status" : "alert");
  el.setAttribute("aria-live", polite ? "polite" : "assertive");
  el.className = "sr-only";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
