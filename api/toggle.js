import { kv } from "@vercel/kv";

const STATUS_KEY = "registration:open";

export default async function handler(req, res) {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Auth: cek password dari env var atau body
    const adminPassword = process.env.ADMIN_PASSWORD || "toyo2026admin";
    const { password, isOpen } = req.body || {};

    if (!password || password !== adminPassword) {
        return res.status(401).json({ error: "Password salah" });
    }

    if (typeof isOpen !== "boolean") {
        return res.status(400).json({ error: "Field 'isOpen' harus boolean" });
    }

    try {
        await kv.set(STATUS_KEY, isOpen);
        return res.status(200).json({
            success: true,
            isOpen,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("KV error:", error);
        return res.status(500).json({
            error: "Gagal menyimpan status. Pastikan Vercel KV sudah di-setup.",
        });
    }
}
