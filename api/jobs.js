// api/jobs.js
// GET: list lowongan + status buka/tutup + slot info + visibility.
// - Merge data/jobs.json (seed) + Neon `jobs` (dinamis)
// - Hitung filled/available dari pendaftar berstatus "lolos"
// - Auto-close lowongan jika slot habis
// - Filter hidden jobs (kecuali admin request dengan ?includeHidden=1 + auth)

import fs from "fs/promises";
import path from "path";
import { getDB, ensureSchema } from "./db.js";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");

function checkAdmin(req) {
    const adminPassword = process.env.ADMIN_PASSWORD || "123";
    return req.headers["x-admin-password"] === adminPassword;
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    try {
        // 1) Seed dari JSON
        const jobsData = JSON.parse(await fs.readFile(JOBS_FILE, "utf-8"));
        const brand = jobsData.brand || {};
        const baseJobs = Array.isArray(jobsData.jobs) ? jobsData.jobs : [];

        // 2) Dynamic jobs dari Neon
        let dynamicJobs = [];
        try {
            await ensureSchema();
            const sql = getDB();
            const rows = await sql`SELECT data FROM jobs ORDER BY created_at DESC`;
            dynamicJobs = rows.map((r) => r.data).filter(Boolean);
        } catch (dbErr) {
            console.warn("[jobs] Neon unavailable, using JSON only:", dbErr.message);
        }

        // 3) Merge
        const jobMap = new Map();
        for (const j of baseJobs) jobMap.set(j.id, j);
        for (const j of dynamicJobs) jobMap.set(j.id, j);
        const jobs = Array.from(jobMap.values());

        // 4) Open/closed status
        const openStatus = {};
        for (const j of jobs) openStatus[j.id] = true;
        try {
            const sql = getDB();
            const statusRows = await sql`SELECT job_id, is_open FROM job_status`;
            for (const row of statusRows) openStatus[row.job_id] = row.is_open;
        } catch {
            // ignore
        }

        // 5) Filled (dari registrations "lolos")
        const slotMap = {};
        try {
            const sql = getDB();
            const filledRows = await sql`
                SELECT job_id, COUNT(*)::int AS filled
                FROM registrations
                WHERE status = 'lolos'
                GROUP BY job_id
            `;
            for (const r of filledRows) slotMap[r.job_id] = r.filled;
        } catch {
            // ignore
        }

        // 6) Visibility (hide/unhide)
        const visibilityMap = {};
        try {
            const sql = getDB();
            const visRows = await sql`SELECT job_id, is_hidden FROM job_visibility`;
            for (const r of visRows) visibilityMap[r.job_id] = r.is_hidden;
        } catch {
            // ignore
        }

        // 7) Enrich setiap job
        const enriched = jobs.map((j) => {
            const slots = Number(j.slots || j.vacancies || 0);
            const filled = slotMap[j.id] || 0;
            const available = Math.max(0, slots - filled);
            const isHidden = visibilityMap[j.id] || j.isHidden || false;
            if (slots > 0 && available <= 0) openStatus[j.id] = false;
            return { ...j, slots, filled, available, isHidden };
        });

        // 8) Filter hidden kecuali admin minta
        const wantAll = req.query?.includeHidden === "1" && checkAdmin(req);
        const visible = wantAll ? enriched : enriched.filter((j) => !j.isHidden);

        return res.status(200).json({ brand, jobs: visible, openStatus });
    } catch (err) {
        console.error("Jobs API error:", err);
        return res.status(500).json({ error: "Gagal memuat data lowongan: " + err.message });
    }
}
