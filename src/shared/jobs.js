export function normalizeGender(gender) {
  return ["male", "female", "all"].includes(gender) ? gender : "all";
}

export function genderLabel(gender) {
  if (gender === "male") return "Pria";
  if (gender === "female") return "Wanita";
  return "Pria & Wanita";
}

export function genderIcon(gender) {
  if (gender === "male") return "👨";
  if (gender === "female") return "👩";
  return "👥";
}

export function normalizeJob(job = {}) {
  const slots = Number(job.slots ?? job.vacancies ?? 0) || 0;
  const availableRaw = job.available != null ? Number(job.available) : null;
  const filledRaw = job.filled != null ? Number(job.filled) : null;
  const filled = filledRaw != null && !Number.isNaN(filledRaw)
    ? Math.max(0, filledRaw)
    : availableRaw != null && !Number.isNaN(availableRaw)
      ? Math.max(0, slots - availableRaw)
      : 0;
  const available = availableRaw != null && !Number.isNaN(availableRaw)
    ? Math.max(0, availableRaw)
    : Math.max(0, slots - filled);

  return {
    ...job,
    id: String(job.id || "").trim(),
    gender: normalizeGender(job.gender),
    slots,
    vacancies: job.vacancies ?? slots,
    candidates: Number(job.candidates || 0),
    available,
    filled,
    isHidden: Boolean(job.isHidden),
    company: {
      jp: job.company?.jp || "—",
      romaji: job.company?.romaji || "—",
    },
    salary: {
      gross: Number(job.salary?.gross || 0),
      grossHourly: job.salary?.grossHourly ? Number(job.salary.grossHourly) : null,
      net: Number(job.salary?.net || 0),
    },
    interview: {
      date: job.interview?.date || "",
      type: job.interview?.type === "online" ? "online" : "offline",
    },
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
  };
}

export function normalizeJobs(jobs = []) {
  return jobs.map(normalizeJob).filter((job) => job.id);
}

export function filterJobs(jobs, filter) {
  if (!filter || filter === "all") return jobs;
  return jobs.filter((job) => job.gender === filter || job.gender === "all");
}

export function slotStats(job) {
  const slots = Number(job.slots || job.vacancies || 0) || 0;
  const filled = Math.max(0, Number(job.filled || 0));
  const available = Math.max(0, Number(job.available ?? slots - filled));
  const filledPct = slots > 0 ? Math.min(100, Math.max(0, (filled / slots) * 100)) : 0;
  return { slots, filled, available, filledPct };
}
