-- schema.sql
-- Schema untuk Neon Postgres (otomatis di-bootstrap oleh api/db.js,
-- tapi file ini berguna sebagai dokumentasi / untuk setup manual).
--
-- Cara pakai di Neon SQL Editor:
--   1. Buka https://console.neon.tech
--   2. Pilih project yang terhubung ke Vercel
--   3. Klik "SQL Editor" → paste isi file ini → Run
--
-- Tabel yang dibuat:
--   job_status        — status buka/tutup per lowongan
--   job_visibility    — hide/unhide flag per lowongan
--   job_visibility_log— history/audit trail untuk hide/unhide
--   jobs              — lowongan dinamis (dibuat via admin panel)
--   registrations     — data pendaftar

CREATE TABLE IF NOT EXISTS job_status (
    job_id     TEXT PRIMARY KEY,
    is_open    BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_visibility (
    job_id     TEXT PRIMARY KEY,
    is_hidden  BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_visibility_log (
    id        SERIAL PRIMARY KEY,
    job_id    TEXT NOT NULL,
    action    TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
    id         TEXT PRIMARY KEY,
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registrations (
    id                TEXT PRIMARY KEY,
    job_id            TEXT NOT NULL,
    name              TEXT NOT NULL,
    phone             TEXT NOT NULL,
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status            TEXT NOT NULL DEFAULT 'pending',
    status_updated_at TIMESTAMPTZ,
    ip                TEXT
);

CREATE INDEX IF NOT EXISTS idx_registrations_job_id ON registrations(job_id);
CREATE INDEX IF NOT EXISTS idx_registrations_timestamp ON registrations(timestamp DESC);
