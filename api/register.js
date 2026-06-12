// api/register.js
// POST: simpan pendaftar baru ke Neon Postgres.
// Input: { jobId, name, phone }  (email sudah dihapus)

import fs from "fs/promises";
import path from "path";
import { getDB, ensureSchema } from "./db.js";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");

function validatePhone(phone) {
    const digits = String(phone).replace(/\D/g, "");
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

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { jobId, name, phone } = req.body || {};

    // ===== Validation =====
    if (!jobId || typeof jobId !== "string") {
        return res.status(400).json({ error: "jobId wajib diisi" });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 100) {
        return res.status(400).json({ error: "Nama harus 2-100 karakter" });
    }
    if (!phone || typeof phone !== "string" || !validatePhone(phone)) {
        return res.status(400).json({ error: "Nomor handphone tidak valid (8-20 digit)" });
    }

    // ===== Verify job exists =====
    try {
        const jobsData = JSON.parse(await fs.readFile(JOBS_FILE, "utf-8"));
        const inJson = (jobsData.jobs || []).some((j) => j.id === jobId);

        let inDb = false;
        try {
            await ensureSchema();
            const sql = getDB();
            const rows = await sql`SELECT 1 FROM jobs WHERE id = ${jobId} LIMIT 1`;
            inDb = rows.length > 0;
        } catch {
            // DB belum siap / tidak ada — job dianggap ada jika ada di JSON
        }

        if (!inJson && !inDb) {
            return res.status(404).json({ error: "Lowongan tidak ditemukan" });
        }

        // Cek status buka/tutup
        try {
            const sql = getDB();
            const rows = await sql`SELECT is_open FROM job_status WHERE job_id = ${jobId} LIMIT 1`;
            if (rows.length > 0 && rows[0].is_open === false) {
                return res.status(403).json({ error: "Pendaftaran untuk lowongan ini sudah ditutup" });
            }
        } catch {
            // DB unavailable, default: terbuka
        }
    } catch (err) {
        console.error("Job lookup error:", err);
        return res.status(500).json({ error: "Terjadi kesalahan server" });
    }

    // ===== Save registration =====
    const registration = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        jobId,
        name: name.trim(),
        phone: phone.trim(),
        timestamp: new Date().toISOString(),
        status: "pending",
        ip: getClientIp(req).substring(0, 50),
    };

    try {
        await ensureSchema();
        const sql = getDB();
        await sql`
            INSERT INTO registrations (id, job_id, name, phone, timestamp, status, ip)
            VALUES (${registration.id}, ${registration.jobId}, ${registration.name},
                    ${registration.phone}, ${registration.timestamp}, ${registration.status},
                    ${registration.ip})
        `;
        return res.status(200).json({
            success: true,
            id: registration.id,
            message: "Pendaftaran berhasil disimpan",
        });
    } catch (err) {
        console.error("Save registration error:", err);
        return res.status(503).json({
            error: "Pendaftaran gagal disimpan. Database error: " + err.message,
        });
    }
}
