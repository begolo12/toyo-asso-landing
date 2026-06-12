import { kv } from "@vercel/kv";

const STATUS_KEY = "registration:open";

export default async function handler(req, res) {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // Default: terbuka (open)
        const isOpen = (await kv.get(STATUS_KEY)) ?? true;
        return res.status(200).json({
            isOpen: Boolean(isOpen),
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        // Jika KV belum di-setup, default ke terbuka
        console.error("KV error:", error);
        return res.status(200).json({
            isOpen: true,
            updatedAt: new Date().toISOString(),
            note: "Default state (KV not configured)",
        });
    }
}
