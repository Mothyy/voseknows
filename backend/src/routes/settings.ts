import express = require("express");
const { query } = require("../db");
const auth = require("../middleware/auth");
import type { Response } from "express";
import crypto = require("crypto");

const router = express.Router();

router.use(auth);

// @route   GET /api/settings
router.get("/", async (req: any, res: Response) => {
    try {
        const result = await query(
            "SELECT email, session_timeout_minutes FROM users WHERE id = $1",
            [req.user.id]
        );

        const apiKeys = await query(
            "SELECT id, name, key_hint, created_at, last_used_at FROM api_keys WHERE user_id = $1",
            [req.user.id]
        );

        res.json({
            user: result.rows[0],
            apiKeys: apiKeys.rows
        });
    } catch (err) {
        console.error("Fetch Settings Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/settings/timeout
router.post("/timeout", async (req: any, res: Response) => {
    const { minutes } = req.body;
    if (!minutes || minutes < 1) {
        return res.status(400).json({ message: "Invalid timeout value" });
    }

    try {
        await query(
            "UPDATE users SET session_timeout_minutes = $1 WHERE id = $2",
            [minutes, req.user.id]
        );
        res.json({ message: "Timeout updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/settings/api-keys
router.post("/api-keys", async (req: any, res: Response) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    try {
        // Generate a random key
        const rawKey = `vk_${crypto.randomBytes(24).toString("hex")}`;
        // Use SHA-256 with a salt (secure and fast for repeated API auth)
        const salt = process.env.JWT_SECRET || "voseknows_salt";
        const keyHash = crypto.createHash("sha256").update(rawKey + salt).digest("hex");
        // Create a more useful hint: vk_...hash
        const keyHint = `vk_...${rawKey.substring(rawKey.length - 4)}`;

        await query(
            "INSERT INTO api_keys (user_id, name, key_hash, key_hint) VALUES ($1, $2, $3, $4)",
            [req.user.id, name, keyHash, keyHint]
        );

        // Return the RAW key only once!
        res.status(201).json({
            name,
            key: rawKey,
            message: "Keep this key safe. You will not see it again."
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// @route   DELETE /api/settings/api-keys/:id
router.delete("/api-keys/:id", async (req: any, res: Response) => {
    try {
        await query(
            "DELETE FROM api_keys WHERE id = $1 AND user_id = $2",
            [req.params.id, req.user.id]
        );
        res.json({ message: "API key deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
