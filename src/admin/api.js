const JOBS_API = "/api/jobs";
const ADMIN_API = "/api/admin";

export function createAdminApi(state) {
  async function jsonFetch(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function authHeaders(extra = {}) {
    return state.apiHeaders(extra);
  }

  return {
    verify() {
      return fetch(`${ADMIN_API}?jobId=_verify`, { headers: authHeaders() });
    },
    getJobs({ includeHidden = false } = {}) {
      return jsonFetch(`${JOBS_API}${includeHidden ? "?includeHidden=1" : ""}`, {
        headers: includeHidden ? authHeaders() : {},
      });
    },
    getAllRegistrations() {
      return jsonFetch(`${ADMIN_API}?all=1`, { headers: authHeaders() });
    },
    getVisibilityLog() {
      return jsonFetch(`${ADMIN_API}?log=visibility`, { headers: authHeaders() });
    },
    post(action, payload = {}) {
      return jsonFetch(ADMIN_API, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ action, password: state.password, ...payload }),
      });
    },
    toggleJob(jobId, isOpen) {
      return this.post("toggle", { jobId, isOpen });
    },
    toggleVisibility(jobId, isHidden) {
      return this.post("toggleVisibility", { jobId, isHidden });
    },
    setStatus(regId, jobId, status) {
      return this.post("setStatus", { regId, jobId, status });
    },
    clearRegistrations() {
      return this.post("clearRegistrations");
    },
    saveJob(job, editId = "") {
      return this.post(editId ? "editJob" : "createJob", { job });
    },
    deleteJob(jobId) {
      return this.post("deleteJob", { jobId });
    },
  };
}
