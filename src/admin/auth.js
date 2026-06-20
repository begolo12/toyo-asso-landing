import { qs } from "../shared/dom.js";
import { toast } from "../shared/toast.js";

export function initAuth({ state, api, onLogin }) {
  const loginForm = qs("#loginForm");
  const loginError = qs("#loginError");
  const passwordInput = qs("#passwordInput");
  const loginScreen = qs("#loginScreen");
  const dashboard = qs("#dashboard");
  const logoutBtn = qs("#logoutBtn");

  function showDashboard() {
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    qs("#btnCreateJob")?.focus?.();
  }

  function showLogin() {
    dashboard.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    passwordInput.value = "";
    passwordInput.focus();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const pwd = passwordInput.value;
    if (!pwd) return;

    state.setPassword(pwd);
    try {
      const verifyRes = await api.verify();
      if (verifyRes.status === 401) {
        throw new Error("Password salah.");
      }
      showDashboard();
      toast({ message: "Login berhasil.", type: "success" });
      await onLogin();
    } catch (err) {
      loginError.textContent = err.message || "Login gagal.";
      state.setPassword("");
    }
  });

  logoutBtn.addEventListener("click", () => {
    state.setPassword("");
    showLogin();
    toast({ message: "Anda telah keluar dari admin panel.", type: "info" });
  });

  async function resume() {
    if (!state.password) return;
    try {
      const verifyRes = await api.verify();
      if (verifyRes.status === 401) throw new Error("Password salah.");
      showDashboard();
      await onLogin();
    } catch {
      state.setPassword("");
      showLogin();
    }
  }

  return { resume, showDashboard, showLogin };
}
