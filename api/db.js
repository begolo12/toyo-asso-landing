// api/_db.js
// Shared Neon database connection + schema bootstrap.
// Dipakai oleh semua API endpoint di /api.
//
// Env yang dibutuhkan (otomatis tersedia di Vercel via Neon integration):
//   DATABASE_URL  — connection string Neon (postgres://...)
//
// Schema di-bootstrap otomatis (CREATE TABLE IF NOT EXISTS) supaya user
// tidak perlu jalankan SQL manual. Untuk kontrol penuh, lihat schema.sql.

import { neon } from "@neondatabase/serverless";

let _sql = null;

export function getDB() {
    if (!_sql) {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error(
                "DATABASE_URL belum diset. Hubungkan Neon di Vercel: " +
                    "Project → Storage → Create Database → Neon → Connect to Project."
            );
        }
        _sql = neon(url);
    }
    return _sql;
}

export async function ensureSchema() {
    const sql = getDB();
    // Status buka/tutup per lowongan
    await sql`CREATE TABLE IF NOT EXISTS job_status (
        job_id     TEXT PRIMARY KEY,
        is_open    BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    // Lowongan dinamis (dibuat via admin). data = JSONB berisi schema job lengkap.
    await sql`CREATE TABLE IF NOT EXISTS jobs (
        id         TEXT PRIMARY KEY,
        data       JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    // Pendaftar
    await sql`CREATE TABLE IF NOT EXISTS registrations (
        id                TEXT PRIMARY KEY,
        job_id            TEXT NOT NULL,
        name              TEXT NOT NULL,
        phone             TEXT NOT NULL,
        timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status            TEXT NOT NULL DEFAULT 'pending',
        status_updated_at TIMESTAMPTZ,
        ip                TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_registrations_job_id ON registrations(job_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_registrations_timestamp ON registrations(timestamp DESC)`;
}
