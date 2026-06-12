// local-server.js
// Local dev server untuk landing page LPK.
// - Serve static files
// - Mock /api/jobs, /api/register, /api/admin dengan storage file-backed (data/registrations.json)
//   supaya data TIDAK hilang saat restart. Persis sama dengan Vercel KV structure.
//
// Struktur storage (mirror @vercel/kv keys):
//   jobsStatus:     { "<jobId>": "1" | "0" }        ← sama dengan kv.hgetall("jobs:open")
//   registrations:  { "<jobId>": [<json-string>, …] } ← sama dengan kv.lrange("reg:<jobId>")
//
// Password admin default: "123" (override via env var ADMIN_PASSWORD).

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "registrations.json");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123";
const REG_STATUSES = ["pending", "lolos", "tidak_lolos"];

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

// ===== File-backed store =====
let store = { jobsStatus: {}, registrations: {}, jobVisibility: {}, visibilityLog: [] };

function loadStoreSync() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, "utf-8");
            const parsed = JSON.parse(raw);
            store.jobsStatus = parsed.jobsStatus || {};
            store.registrations = parsed.registrations || {};
            store.jobVisibility = parsed.jobVisibility || {};
            store.visibilityLog = parsed.visibilityLog || [];
        } else {
            // Default: semua lowongan terbuka
            try {
                const jobsData = JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8"));
                for (const j of jobsData.jobs) store.jobsStatus[j.id] = "1";
            } catch {
                /* jobs.json belum ada, skip */
            }
        }
    } catch (err) {
        console.warn("[WARN] Gagal baca store, mulai fresh:", err.message);
        store = { jobsStatus: {}, registrations: {}, jobVisibility: {}, visibilityLog: [] };
    }
}

let saveTimer = null;
function saveStore() {
    // Debounce biar multiple writes cepat tidak rebut file
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        try {
            await fsp.mkdir(DATA_DIR, { recursive: true });
            await fsp.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
        } catch (err) {
            console.error("[ERROR] Gagal save store:", err.message);
        }
    }, 50);
}

// ===== Mini @vercel/kv API for local =====
const localKV = {
    async lrange(key, start, stop) {
        const listKey = key.replace(/^reg:/, "");
        const arr = store.registrations[listKey] || [];
        const end = stop === -1 ? undefined : stop + 1;
        return arr.slice(start, end);
    },
    async lpush(key, val) {
        const listKey = key.replace(/^reg:/, "");
        if (!store.registrations[listKey]) store.registrations[listKey] = [];
        store.registrations[listKey].unshift(val);
        saveStore();
        return store.registrations[listKey].length;
    },
    async rpush(key, val) {
        const listKey = key.replace(/^reg:/, "");
        if (!store.registrations[listKey]) store.registrations[listKey] = [];
        store.registrations[listKey].push(val);
        saveStore();
        return store.registrations[listKey].length;
    },
    async del(key) {
        const listKey = key.replace(/^reg:/, "");
        if (store.registrations[listKey] !== undefined) {
            delete store.registrations[listKey];
            saveStore();
            return 1;
        }
        return 0;
    },
    async hget(key, field) {
        return store.jobsStatus[field] || null;
    },
    async hgetall(key) {
        return { ...store.jobsStatus };
    },
    async hset(key, obj) {
        Object.assign(store.jobsStatus, obj);
        saveStore();
        return Object.keys(obj).length;
    },
    async incr(key) {
        // Simple counter untuk rate limit (in-memory only)
        if (!localKV._counters) localKV._counters = {};
        localKV._counters[key] = (localKV._counters[key] || 0) + 1;
        return localKV._counters[key];
    },
    async expire(key, seconds) {
        // In-memory TTL
        setTimeout(() => {
            if (localKV._counters) delete localKV._counters[key];
        }, seconds * 1000).unref();
        return 1;
    },
};

// ===== Helpers =====
function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
}

function sendJson(res, status, body) {
    setCors(res);
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
    });
}

function checkAuth(body, headers) {
    const provided = body?.password || headers["x-admin-password"];
    return provided === ADMIN_PASSWORD;
}

function validatePhone(phone) {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 20;
}

function getClientIp(req) {
    return (
        req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
        req.headers["x-real-ip"]?.toString() ||
        req.socket?.remoteAddress ||
        "unknown"
    );
}

// ===== Server =====
loadStoreSync();

const server = http.createServer(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.statusCode = 200;
        return res.end();
    }

    const url = req.url.split("?")[0];

    // ====== API: GET /api/jobs ======
    if (req.method === "GET" && url === "/api/jobs") {
        try {
            const jobsData = JSON.parse(await fsp.readFile(JOBS_FILE, "utf-8"));
            const openStatusRaw = await localKV.hgetall("jobs:open");
            const status = {};
            for (const job of jobsData.jobs) {
                if (job.id in openStatusRaw) {
                    status[job.id] = openStatusRaw[job.id] === "1";
                } else {
                    status[job.id] = true; // default open
                }
            }
            // Hitung filled dari registrations berstatus "lolos"
            const filledMap = {};
            for (const job of jobsData.jobs) {
                const regs = await localKV.lrange(`reg:${job.id}`, 0, -1);
                let n = 0;
                for (const r of regs) {
                    try {
                        const obj = JSON.parse(r);
                        if (obj && obj.status === "lolos") n++;
                    } catch { /* skip */ }
                }
                filledMap[job.id] = n;
            }
            // Enrich jobs dengan slots/filled/available, auto-close kalau habis
            const enriched = jobsData.jobs.map((j) => {
                const slots = Number(j.slots || j.vacancies || 0);
                const filled = filledMap[j.id] || 0;
                const available = Math.max(0, slots - filled);
                if (slots > 0 && available <= 0) status[j.id] = false;
                const isHidden = !!store.jobVisibility[j.id];
                return { ...j, slots, filled, available, isHidden };
            });
            // Filter hidden (admin bisa lihat semua dengan ?includeHidden=1, tanpa auth di local)
            const wantAll = url.includes("includeHidden=1");
            const visible = wantAll ? enriched : enriched.filter((j) => !j.isHidden);
            return sendJson(res, 200, {
                brand: jobsData.brand,
                jobs: visible,
                openStatus: status,
            });
        } catch (e) {
            return sendJson(res, 500, { error: "Gagal memuat data lowongan: " + e.message });
        }
    }

    // ====== API: POST /api/register ======
    if (req.method === "POST" && url === "/api/register") {
        const body = await readBody(req);
        let data = {};
        try { data = body ? JSON.parse(body) : {}; } catch { data = {}; }

        const { jobId, name, phone } = data;

        if (!jobId || typeof jobId !== "string") {
            return sendJson(res, 400, { error: "jobId wajib diisi" });
        }
        if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 100) {
            return sendJson(res, 400, { error: "Nama harus 2-100 karakter" });
        }
        if (!phone || typeof phone !== "string" || !validatePhone(phone)) {
            return sendJson(res, 400, { error: "Nomor handphone tidak valid (8-20 digit)" });
        }

        // Verify job exists
        let job = null;
        try {
            const jobsData = JSON.parse(await fsp.readFile(JOBS_FILE, "utf-8"));
            job = jobsData.jobs.find((j) => j.id === jobId);
        } catch (e) {
            return sendJson(res, 500, { error: "Terjadi kesalahan server" });
        }
        if (!job) return sendJson(res, 404, { error: "Lowongan tidak ditemukan" });

        // Check if job is open
        const jobStatus = (await localKV.hget("jobs:open", jobId)) ?? "1";
        if (jobStatus === "0") {
            return sendJson(res, 403, { error: "Pendaftaran untuk lowongan ini sudah ditutup" });
        }

        // Rate limit (best effort)
        const ip = getClientIp(req);
        const rateKey = `ratelimit:register:${ip}`;
        const current = await localKV.incr(rateKey);
        if (current === 1) await localKV.expire(rateKey, 300);
        if (current > 5) {
            return sendJson(res, 429, { error: "Terlalu banyak percobaan. Coba lagi dalam 5 menit." });
        }

        const registration = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            jobId,
            name: name.trim(),
            phone: phone.trim(),
            timestamp: new Date().toISOString(),
            status: "pending",
            ip: ip.substring(0, 50),
        };

        await localKV.lpush(`reg:${jobId}`, JSON.stringify(registration));
        console.log(`[REGISTER] jobId=${jobId} name=${name} phone=${phone} id=${registration.id}`);
        return sendJson(res, 200, {
            success: true,
            id: registration.id,
            message: "Pendaftaran berhasil disimpan",
        });
    }

    // ====== API: /api/admin ======
    if (url.startsWith("/api/admin")) {
        const body = await readBody(req);
        let data = {};
        try { data = body ? JSON.parse(body) : {}; } catch { data = {}; }

        if (!checkAuth(data, req.headers)) {
            return sendJson(res, 401, { error: "Password salah" });
        }

        // POST: actions
        if (req.method === "POST") {
            const { action } = data;

            if (action === "setStatus") {
                const { regId, jobId, status } = data;
                if (!regId || !jobId || !status) {
                    return sendJson(res, 400, { error: "regId, jobId, dan status wajib diisi" });
                }
                if (!REG_STATUSES.includes(status)) {
                    return sendJson(res, 400, { error: `status harus salah satu dari: ${REG_STATUSES.join(", ")}` });
                }
                const key = `reg:${jobId}`;
                const raw = (await localKV.lrange(key, 0, -1)) || [];
                let found = false;
                const updated = raw.map((r) => {
                    try {
                        const obj = JSON.parse(r);
                        if (obj && obj.id === regId) {
                            obj.status = status;
                            obj.statusUpdatedAt = new Date().toISOString();
                            found = true;
                        }
                        return JSON.stringify(obj);
                    } catch { return r; }
                });
                if (!found) return sendJson(res, 404, { error: "Pendaftar tidak ditemukan" });
                await localKV.del(key);
                for (const item of updated) await localKV.rpush(key, item);

                // Auto-close job jika slot habis
                try {
                    let lolosCount = 0;
                    for (const r of updated) {
                        try {
                            const obj = JSON.parse(r);
                            if (obj && obj.status === "lolos") lolosCount++;
                        } catch { /* skip */ }
                    }
                    const jobsData = JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8"));
                    const job = (jobsData.jobs || []).find((j) => j.id === jobId);
                    const slots = job ? Number(job.slots || job.vacancies || 0) : 0;
                    if (slots > 0 && lolosCount >= slots) {
                        await localKV.hset("jobs:open", { [jobId]: "0" });
                    }
                } catch (slotErr) {
                    console.warn("[setStatus] slot tracking skipped:", slotErr.message);
                }

                return sendJson(res, 200, { success: true, regId, jobId, status });
            }

            // clearRegistrations: hapus semua data pendaftar (reset)
            if (action === "clearRegistrations") {
                store.registrations = {};
                saveStore();
                return sendJson(res, 200, { success: true, deleted: true });
            }

            // toggle (backward compat dengan yang tanpa action field)
            if (action === "toggle" || (action === undefined && data.jobId && typeof data.isOpen === "boolean")) {
                if (!data.jobId || typeof data.isOpen !== "boolean") {
                    return sendJson(res, 400, { error: "jobId dan isOpen (boolean) wajib diisi" });
                }
                await localKV.hset("jobs:open", { [data.jobId]: data.isOpen ? "1" : "0" });
                return sendJson(res, 200, {
                    success: true,
                    jobId: data.jobId,
                    isOpen: data.isOpen,
                    updatedAt: new Date().toISOString(),
                });
            }

            // createJob: tambah lowongan baru (write ke data/jobs.json)
            if (action === "createJob") {
                const job = data.job;
                if (!job || typeof job !== "object") {
                    return sendJson(res, 400, { error: "body.job wajib diisi" });
                }
                const errors = [];
                if (!job.id) errors.push("id");
                if (!job.company?.jp) errors.push("company.jp");
                if (!job.company?.romaji) errors.push("company.romaji");
                if (!job.industry) errors.push("industry");
                if (!job.location) errors.push("location");
                if (!job.salary?.gross) errors.push("salary.gross");
                if (!job.salary?.net) errors.push("salary.net");
                if (!job.interview?.date) errors.push("interview.date");
                if (!job.interview?.type) errors.push("interview.type");
                if (errors.length > 0) {
                    return sendJson(res, 400, { error: `Field wajib belum diisi: ${errors.join(", ")}` });
                }
                const cleanId = String(job.id).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
                if (!cleanId) {
                    return sendJson(res, 400, { error: "id lowongan tidak valid" });
                }
                const newJob = {
                    id: cleanId,
                    gender: ["male", "female", "all"].includes(job.gender) ? job.gender : "all",
                    slots: Number(job.slots) || Number(job.vacancies) || 0,
                    company: {
                        jp: String(job.company.jp).trim(),
                        romaji: String(job.company.romaji).trim(),
                    },
                    industry: String(job.industry).trim(),
                    industryJp: job.industryJp ? String(job.industryJp).trim() : "",
                    location: String(job.location).trim(),
                    vacancies: job.vacancies != null ? job.vacancies : 0,
                    candidates: job.candidates != null ? Number(job.candidates) : 0,
                    salary: {
                        gross: Number(job.salary.gross),
                        grossHourly: job.salary.grossHourly ? Number(job.salary.grossHourly) : null,
                        net: Number(job.salary.net),
                    },
                    interview: {
                        date: job.interview.date,
                        type: job.interview.type === "online" ? "online" : "offline",
                    },
                    description: job.description ? String(job.description).trim() : "",
                    requirements: Array.isArray(job.requirements)
                        ? job.requirements.map((r) => String(r).trim()).filter(Boolean)
                        : [],
                    mensetsuNotes: job.mensetsuNotes ? String(job.mensetsuNotes).trim() : "",
                };
                try {
                    const raw = await fsp.readFile(JOBS_FILE, "utf-8");
                    const jobsData = JSON.parse(raw);
                    const idx = jobsData.jobs.findIndex((j) => j.id === cleanId);
                    if (idx >= 0) jobsData.jobs[idx] = newJob;
                    else jobsData.jobs.push(newJob);
                    await fsp.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));
                    return sendJson(res, 200, { success: true, job: newJob });
                } catch (e) {
                    return sendJson(res, 500, { error: "Gagal simpan jobs.json: " + e.message });
                }
            }

            // editJob: update lowongan yang sudah ada
            if (action === "editJob") {
                const job = data.job;
                if (!job || typeof job !== "object") {
                    return sendJson(res, 400, { error: "body.job wajib diisi" });
                }
                if (!job.id) return sendJson(res, 400, { error: "id lowongan wajib diisi" });
                const errors = [];
                if (!job.company?.jp) errors.push("company.jp");
                if (!job.company?.romaji) errors.push("company.romaji");
                if (!job.industry) errors.push("industry");
                if (!job.location) errors.push("location");
                if (!job.salary?.gross) errors.push("salary.gross");
                if (!job.salary?.net) errors.push("salary.net");
                if (!job.interview?.date) errors.push("interview.date");
                if (!job.interview?.type) errors.push("interview.type");
                if (errors.length > 0) {
                    return sendJson(res, 400, { error: `Field wajib belum diisi: ${errors.join(", ")}` });
                }
                const newJob = {
                    id: job.id,
                    gender: ["male", "female", "all"].includes(job.gender) ? job.gender : "all",
                    slots: Number(job.slots) || Number(job.vacancies) || 0,
                    company: {
                        jp: String(job.company.jp).trim(),
                        romaji: String(job.company.romaji).trim(),
                    },
                    industry: String(job.industry).trim(),
                    industryJp: job.industryJp ? String(job.industryJp).trim() : "",
                    location: String(job.location).trim(),
                    vacancies: job.vacancies != null ? job.vacancies : 0,
                    candidates: job.candidates != null ? Number(job.candidates) : 0,
                    salary: {
                        gross: Number(job.salary.gross),
                        grossHourly: job.salary.grossHourly ? Number(job.salary.grossHourly) : null,
                        net: Number(job.salary.net),
                    },
                    interview: {
                        date: job.interview.date,
                        type: job.interview.type === "online" ? "online" : "offline",
                    },
                    description: job.description ? String(job.description).trim() : "",
                    requirements: Array.isArray(job.requirements)
                        ? job.requirements.map((r) => String(r).trim()).filter(Boolean)
                        : [],
                    mensetsuNotes: job.mensetsuNotes ? String(job.mensetsuNotes).trim() : "",
                };
                try {
                    const raw = await fsp.readFile(JOBS_FILE, "utf-8");
                    const jobsData = JSON.parse(raw);
                    const idx = jobsData.jobs.findIndex((j) => j.id === job.id);
                    if (idx >= 0) jobsData.jobs[idx] = newJob;
                    else jobsData.jobs.push(newJob);
                    await fsp.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));
                    return sendJson(res, 200, { success: true, job: newJob });
                } catch (e) {
                    return sendJson(res, 500, { error: "Gagal simpan jobs.json: " + e.message });
                }
            }

            // toggleVisibility: hide/unhide job dari web (admin masih bisa lihat)
            if (action === "toggleVisibility") {
                const { jobId, isHidden } = data;
                if (!jobId) return sendJson(res, 400, { error: "jobId wajib diisi" });
                store.jobVisibility[jobId] = !!isHidden;
                // Log ke audit trail
                if (!store.visibilityLog) store.visibilityLog = [];
                store.visibilityLog.push({
                    jobId,
                    action: isHidden ? "hide" : "unhide",
                    timestamp: new Date().toISOString(),
                });
                saveStore();
                return sendJson(res, 200, { success: true, jobId, isHidden: !!isHidden });
            }

            return sendJson(res, 400, { error: "action tidak dikenal. Gunakan 'toggle', 'setStatus', 'createJob', 'editJob', atau 'toggleVisibility'." });
        }

        // GET: list
        if (req.method === "GET") {
            const u = new URL(req.url, "http://localhost");

            // Visibility log endpoint (audit trail)
            if (u.searchParams.get("log") === "visibility") {
                const log = (store.visibilityLog || []).slice().reverse();
                return sendJson(res, 200, { log });
            }

            const jobId = u.searchParams.get("jobId");
            const all = u.searchParams.get("all");

            if (all === "1" || all === "true") {
                const jobsData = JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8"));
                const allRegs = [];
                for (const job of jobsData.jobs) {
                    const regs = await localKV.lrange(`reg:${job.id}`, 0, -1);
                    for (const r of regs) {
                        try {
                            const parsed = JSON.parse(r);
                            if (parsed && parsed.id) allRegs.push(parsed);
                        } catch {}
                    }
                }
                allRegs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                return sendJson(res, 200, { registrations: allRegs, count: allRegs.length });
            }

            if (jobId === "_verify") return sendJson(res, 200, { ok: true });

            if (jobId) {
                const regs = await localKV.lrange(`reg:${jobId}`, 0, -1);
                const parsed = regs.map(r => {
                    try { return JSON.parse(r); } catch { return null; }
                }).filter(Boolean);
                return sendJson(res, 200, { jobId, registrations: parsed, count: parsed.length });
            }

            return sendJson(res, 400, { error: "Spesifikkan ?jobId=<id> atau ?all=1" });
        }
    }

    // ====== Static files ======
    let filePath = url === "/" ? "/index.html" : url;
    filePath = path.join(ROOT, filePath);

    // Security: jangan keluar dari ROOT
    if (!filePath.startsWith(ROOT)) {
        res.statusCode = 403;
        return res.end("Forbidden");
    }

    fs.stat(filePath, (err, stat) => {
        if (!err && stat.isDirectory()) {
            filePath = path.join(filePath, "index.html");
        }

        fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
                res.statusCode = 404;
                return res.end("Not found: " + url);
            }
            const ext = path.extname(filePath).toLowerCase();
            res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log("");
    console.log("  ╔══════════════════════════════════════════╗");
    console.log("  ║   LPK — Local Dev Server                 ║");
    console.log("  ╚══════════════════════════════════════════╝");
    console.log("");
    console.log("  → Landing  : http://localhost:" + PORT + "/");
    console.log("  → Admin    : http://localhost:" + PORT + "/admin/");
    console.log("  → Password : " + ADMIN_PASSWORD);
    console.log("");
    console.log("  Data tersimpan di: data/registrations.json");
    console.log("  (tidak hilang saat restart)");
    console.log("  Stop: Ctrl+C");
    console.log("");
});
