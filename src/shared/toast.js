import { qs } from "./dom.js";

let containerEl = null;

function ensureContainer() {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  containerEl = document.createElement("div");
  containerEl.className = "toast-container";
  containerEl.setAttribute("aria-live", "polite");
  containerEl.setAttribute("aria-atomic", "true");
  document.body.appendChild(containerEl);
  return containerEl;
}

export function toast({ message, type = "info", duration = 4000 } = {}) {
  if (!message) return;
  const container = ensureContainer();
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `
    <span class="toast-message"></span>
    <button class="toast-close" type="button" aria-label="Tutup">&times;</button>
  `;
  el.querySelector(".toast-message").textContent = message;
  container.appendChild(el);

  let timer = setTimeout(remove, duration);
  function remove() {
    clearTimeout(timer);
    el.classList.add("toast-leaving");
    setTimeout(() => el.remove(), 200);
  }
  el.querySelector(".toast-close").addEventListener("click", remove);
  el.addEventListener("mouseenter", () => clearTimeout(timer));
  el.addEventListener("focusin", () => clearTimeout(timer));
  el.addEventListener("mouseleave", () => {
    timer = setTimeout(remove, 1500);
  });
  el.addEventListener("focusout", () => {
    timer = setTimeout(remove, 1500);
  });
  return remove;
}

export function confirmDialog({ title = "Konfirmasi", message, confirmText = "Ya", cancelText = "Batal", danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "confirmTitle");
    overlay.innerHTML = `
      <div class="modal-overlay" data-close></div>
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header" style="margin-bottom: 12px;">
          <h2 id="confirmTitle" style="margin:0;"></h2>
        </div>
        <p class="confirm-message" style="margin-bottom: 20px; color: var(--text-muted); line-height: 1.5;"></p>
        <div class="form-actions" style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-secondary" data-close type="button"></button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm type="button"></button>
        </div>
      </div>
    `;
    overlay.querySelector("#confirmTitle").textContent = title;
    overlay.querySelector(".confirm-message").textContent = message || "";
    overlay.querySelector("[data-confirm]").textContent = confirmText;
    overlay.querySelector("[data-close]").textContent = cancelText;
    document.body.appendChild(overlay);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function done(result) {
      document.body.style.overflow = previousOverflow;
      overlay.remove();
      resolve(result);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]") || e.target === overlay || e.target.classList.contains("modal-overlay")) {
        done(false);
      }
    });
    overlay.querySelector("[data-confirm]").addEventListener("click", () => done(true));
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") done(false);
      if (e.key === "Enter") done(true);
    });
    requestAnimationFrame(() => overlay.querySelector("[data-confirm]")?.focus());
  });
}
