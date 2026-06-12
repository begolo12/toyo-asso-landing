// api/admin.js
// Endpoint admin: toggle job, set status pendaftar, create job, hide/unhide.
// Memakai Neon Postgres (lihat api/db.js).
//
// Auth: password dari env ADMIN_PASSWORD (default "123") via header
//       X-Admin-Password atau field body.password.

import { getDB, ensureSchema } from "./db.js";
import fs from "fs/promises";
import path from "path";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");
const REG_STATUSES = ["pending", "lolos", "tidak_lolos"];

function checkAuth(req) {
    const adminPassword = process.env.ADMIN_PASSWORD || "123";
    const provided = req.body?.password || req.headers["x-admin-password"];
    return provided === adminPassword;
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

    if (req.method === "OPTIONS") return res.status(200).end();

    if (!checkAuth(req)) {
        return res.status(401).json({ error: "Password salah" });
    }

    // ===== GET: list registrations =====
    if (req.method === "GET") {
        const { jobId, all } = req.query || {};

        try {
            await ensureSchema();
            const sql = getDB();

            if (all === "1" || all === "true") {
                const rows = await sql`
                    SELECT id, job_id, name, phone, timestamp, status, status_updated_at, ip
                    FROM registrations
                    ORDER BY timestamp DESC
                `;
                const registrations = rows.map(rowToReg);
                return res.status(200).json({ registrations, count: registrations.length });
            }

            if (jobId) {
                const rows = await sql`
                    SELECT id, job_id, name, phone, timestamp, status, status_updated_at, ip
                    FROM registrations
                    WHERE job_id = ${jobId}
                    ORDER BY timestamp DESC
                `;
                const registrations = rows.map(rowToReg);
                return res.status(200).json({ jobId, registrations, count: registrations.length });
            }

            return res.status(400).json({ error: "Spesifikkan ?jobId=<id> atau ?all=1" });
        } catch (err) {
            console.error("List registrations error:", err);
            return res.status(500).json({
                error: "Gagal mengambil data. Pastikan Neon database sudah di-setup: " + err.message,
            });
        }
    }

    // ===== POST: actions =====
    if (req.method === "POST") {
        const body = req.body || {};
        const { action } = body;

        try {
            await ensureSchema();
            const sql = getDB();

            // ---- setStatus ----
            if (action === "setStatus") {
                const { regId, jobId: rJobId, status } = body;
                if (!regId || !rJobId || !status) {
                    return res.status(400).json({ error: "regId, jobId, dan status wajib diisi" });
                }
                if (!REG_STATUSES.includes(status)) {
                    return res.status(400).json({
                        error: `status harus salah satu dari: ${REG_STATUSES.join(", ")}`,
                    });
                }
                const result = await sql`
                    UPDATE registrations
                    SET status = ${status}, status_updated_at = NOW()
                    WHERE id = ${regId} AND job_id = ${rJobId}
                `;
                if (result.count === 0) {
                    return res.status(404).json({ error: "Pendaftar tidak ditemukan" });
                }

                // Auto-close job jika slot habis (filled >= slots)
                try {
                    const filledRows = await sql`
                        SELECT COUNT(*)::int AS filled
                        FROM registrations
                        WHERE job_id = ${rJobId} AND status = 'lolos'
                    `;
                    const filled = Number(filledRows[0]?.filled || 0);
                    const slots = await getJobSlots(rJobId, sql);
                    if (slots > 0 && filled >= slots) {
                        await sql`
                            INSERT INTO job_status (job_id, is_open, updated_at)
                            VALUES (${rJobId}, FALSE, NOW())
                            ON CONFLICT (job_id)
                            DO UPDATE SET is_open = FALSE, updated_at = NOW()
                        `;
                    }
                } catch (slotErr) {
                    console.warn("[setStatus] slot tracking skipped:", slotErr.message);
                }

                return res.status(200).json({ success: true, regId, jobId: rJobId, status });
            }

            // ---- toggle: buka/tutup lowongan ----
            if (action === "toggle" || (action === undefined && body.jobId && typeof body.isOpen === "boolean")) {
                const { jobId: tJobId, isOpen } = body;
                if (!tJobId || typeof isOpen !== "boolean") {
                    return res.status(400).json({ error: "jobId dan isOpen (boolean) wajib diisi" });
                }
                await sql`
                    INSERT INTO job_status (job_id, is_open, updated_at)
                    VALUES (${tJobId}, ${isOpen}, NOW())
                    ON CONFLICT (job_id)
                    DO UPDATE SET is_open = ${isOpen}, updated_at = NOW()
                `;
                return res.status(200).json({
                    success: true,
                    jobId: tJobId,
                    isOpen,
                    updatedAt: new Date().toISOString(),
                });
            }

            // ---- createJob: tambah lowongan baru ----
            if (action === "createJob") {
                const job = body.job;
                if (!job || typeof job !== "object") {
                    return res.status(400).json({ error: "body.job wajib diisi" });
                }

                // Validasi field wajib
                const errors = [];
                if (!job.id || typeof job.id !== "string") errors.push("id");
                if (!job.company?.jp) errors.push("company.jp");
                if (!job.company?.romaji) errors.push("company.romaji");
                if (!job.industry) errors.push("industry");
                if (!job.location) errors.push("location");
                if (!job.salary?.gross) errors.push("salary.gross");
                if (!job.salary?.net) errors.push("salary.net");
                if (!job.interview?.date) errors.push("interview.date");
                if (!job.interview?.type) errors.push("interview.type");
                if (errors.length > 0) {
                    return res.status(400).json({
                        error: `Field wajib belum diisi: ${errors.join(", ")}`,
                    });
                }

                // Bangun objek job yang bersih + sanitize id
                const cleanId = String(job.id)
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, "");
                if (!cleanId) {
                    return res.status(400).json({ error: "id lowongan tidak valid" });
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

                const jobJson = JSON.stringify(newJob);
                await sql`
                    INSERT INTO jobs (id, data, created_at, updated_at)
                    VALUES (${cleanId}, ${jobJson}::jsonb, NOW(), NOW())
                    ON CONFLICT (id)
                    DO UPDATE SET data = ${jobJson}::jsonb, updated_at = NOW()
                `;
                return res.status(200).json({ success: true, job: newJob });
            }

            // ---- toggleVisibility: hide/unhide job dari web (admin masih bisa lihat) ----
            if (action === "toggleVisibility") {
                const { jobId, isHidden } = body;
                if (!jobId) {
                    return res.status(400).json({ error: "jobId wajib diisi" });
                }
                await sql`
                    INSERT INTO job_visibility (job_id, is_hidden, updated_at)
                    VALUES (${jobId}, ${!!isHidden}, NOW())
                    ON CONFLICT (job_id)
                    DO UPDATE SET is_hidden = ${!!isHidden}, updated_at = NOW()
                `;
                return res.status(200).json({ success: true, jobId, isHidden: !!isHidden });
            }

            return res.status(400).json({
                error: "action tidak dikenal. Gunakan 'toggle', 'setStatus', 'createJob', atau 'toggleVisibility'.",
            });
        } catch (err) {
            console.error("Admin action error:", err);
            return res.status(500).json({ error: "Gagal: " + err.message });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}

function rowToReg(r) {
    return {
        id: r.id,
        jobId: r.job_id,
        name: r.name,
        phone: r.phone,
        timestamp: r.timestamp,
        status: r.status,
        statusUpdatedAt: r.status_updated_at,
        ip: r.ip,
    };
}

// Cari nilai `slots` sebuah job (cek JSON file dulu, fallback ke tabel jobs)
async function getJobSlots(jobId, sql) {
    try {
        const jobsData = JSON.parse(await fs.readFile(JOBS_FILE, "utf-8"));
        const fromFile = (jobsData.jobs || []).find((j) => j.id === jobId);
        if (fromFile && fromFile.slots) return Number(fromFile.slots);
        const rows = await sql`SELECT data FROM jobs WHERE id = ${jobId} LIMIT 1`;
        if (rows.length > 0 && rows[0].data?.slots) return Number(rows[0].data.slots);
    } catch {
        // ignore
    }
    return 0;
}
