import express = require("express");
import { Request, Response } from "express";
import { query } from "../db";

const router = express.Router();
const auth = require("../middleware/auth");

router.use(auth);

/**
 * @route   GET /api/integrations/llm
 * @desc    Get configured LLM integrations (masked API keys)
 * @access  Private
 */
router.get("/llm", async (req: any, res: Response) => {
    try {
        const sql = `
            SELECT id, provider, model, is_active, created_at
            FROM llm_settings 
            WHERE user_id = $1
        `;
        const { rows } = await query(sql, [req.user.id]);

        // Front-end implies key exists if row exists
        // We don't verify key validity here, just configuration
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching integrations:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/integrations/llm
 * @desc    Save/Update LLM integration
 * @access  Private
 */
router.post("/llm", async (req: any, res: Response) => {
    const { provider, apiKey, model } = req.body;

    if (!provider || !apiKey) {
        return res.status(400).json({ error: "Provider and API Key are required" });
    }

    try {
        const sql = `
            INSERT INTO llm_settings (user_id, provider, api_key, model)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, provider) 
            DO UPDATE SET api_key = EXCLUDED.api_key, model = EXCLUDED.model, updated_at = NOW()
            RETURNING id, provider, model;
        `;
        const { rows } = await query(sql, [
            req.user.id,
            provider,
            apiKey,
            model || 'gpt-4o'
        ]);

        res.json(rows[0]);
    } catch (err: any) {
        console.error("Error saving integration:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/integrations/llm/:provider
 * @desc    Delete integration
 */
router.delete("/llm/:provider", async (req: any, res: Response) => {
    const { provider } = req.params;
    try {
        await query(
            "DELETE FROM llm_settings WHERE user_id = $1 AND provider = $2",
            [req.user.id, provider]
        );
        res.status(204).send();
    } catch (err: any) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
