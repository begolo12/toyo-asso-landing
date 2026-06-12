// api/jobs.js
// GET: list lowongan + status buka/tutup.
// Merge dari dua sumber:
//   1. data/jobs.json (seed / lowongan statis)
//   2. Neon table `jobs` (lowongan dinamis, dibuat via admin)
// Lowongan dinamis dengan ID yang sama akan menimpa yang dari JSON.

import fs from "fs/promises";
import path from "path";
import { getDB, ensureSchema } from "./db.js";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    try {
        // 1) Seed dari JSON
        const jobsData = JSON.parse(await fs.readFile(JOBS_FILE, "utf-8"));
        const brand = jobsData.brand || {};
        const baseJobs = Array.isArray(jobsData.jobs) ? jobsData.jobs : [];

        // 2) Lowongan dinamis dari Neon
        let dynamicJobs = [];
        try {
            await ensureSchema();
            const sql = getDB();
            const rows = await sql`SELECT data FROM jobs ORDER BY created_at DESC`;
            dynamicJobs = rows.map((r) => r.data).filter(Boolean);
        } catch (dbErr) {
            // Neon belum siap → lanjut dengan base jobs saja
            console.warn("[jobs] Neon unavailable, using JSON only:", dbErr.message);
        }

        // 3) Merge (dynamic override base)
        const jobMap = new Map();
        for (const j of baseJobs) jobMap.set(j.id, j);
        for (const j of dynamicJobs) jobMap.set(j.id, j);
        const jobs = Array.from(jobMap.values());

        // 4) Status buka/tutup per job (default: true)
        const openStatus = {};
        for (const j of jobs) openStatus[j.id] = true;
        try {
            const sql = getDB();
            const statusRows = await sql`SELECT job_id, is_open FROM job_status`;
            for (const row of statusRows) {
                openStatus[row.job_id] = row.is_open;
            }
        } catch (dbErr) {
            console.warn("[jobs] Neon status unavailable, defaulting all to open");
        }

        return res.status(200).json({ brand, jobs, openStatus });
    } catch (err) {
        console.error("Jobs API error:", err);
        return res.status(500).json({ error: "Gagal memuat data lowongan: " + err.message });
    }
}
