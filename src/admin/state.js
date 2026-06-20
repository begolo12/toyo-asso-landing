const PASSWORD_KEY = "admin_password";

export function getStoredPassword() {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredPassword(password) {
  if (password) sessionStorage.setItem(PASSWORD_KEY, password);
  else sessionStorage.removeItem(PASSWORD_KEY);
}

export function createAdminState() {
  let password = getStoredPassword();
  const listeners = new Set();

  return {
    get password() { return password; },
    setPassword(next) {
      password = next;
      setStoredPassword(next);
      listeners.forEach((cb) => cb(password));
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    apiHeaders(extra = {}) {
      return { ...extra, "X-Admin-Password": password };
    },
  };
}
