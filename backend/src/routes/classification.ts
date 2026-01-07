import express = require("express");
import type { Request, Response } from "express";
import { ClassificationService } from "../services/classificationService";
import { query } from "../db";

const router = express.Router();
const auth = require("../middleware/auth");

// Protect all routes with authentication
router.use(auth);

const classificationService = new ClassificationService();

const providerUrls: { [key: string]: string } = {
    openai: 'https://api.openai.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
};

const defaultModels: { [key: string]: string } = {
    openai: 'gpt-4o',
    gemini: 'gemini-1.5-flash',
};

/**
 * @route   POST /api/classification/auto-classify
 * @desc    Triggers LLM-based classification for uncategorized transactions
 * @access  Private
 */
router.post("/auto-classify", async (req: any, res: Response) => {
    try {
        let { apiKey, baseUrl, model, provider, onlyRules } = req.body;

        // If no API Key provided, fetch from Integrations settings
        if (!apiKey) {
            let rows;

            if (provider) {
                const sql = `
                    SELECT api_key, model, provider 
                    FROM llm_settings 
                    WHERE user_id = $1 AND provider = $2 AND is_active = true
                `;
                const res = await query(sql, [req.user.id, provider]);
                rows = res.rows;
            } else {
                // Determine provider automatically
                const sql = `
                    SELECT api_key, model, provider 
                    FROM llm_settings 
                    WHERE user_id = $1 AND is_active = true
                    ORDER BY updated_at DESC
                    LIMIT 1
                `;
                const res = await query(sql, [req.user.id]);
                rows = res.rows;
            }

            if (rows.length > 0) {
                apiKey = rows[0].api_key;
                // Use stored model if not overridden by request
                if (!model) model = rows[0].model;
                // Update provider to match what we found
                provider = rows[0].provider;
            }
        }

        // Set Defaults based on Provider
        const currentProvider = provider || 'openai';
        if (!baseUrl) {
            baseUrl = providerUrls[currentProvider] || providerUrls['openai'];
        }
        if (!model) {
            model = defaultModels[currentProvider] || 'gpt-4o';
        }

        // Note: We no longer block if apiKey is missing. 
        // We proceed to Service which will run Rules and skip AI if no key.


        // Limit to 50 items per batch to prevent timeout/rate limits
        const result = await classificationService.classifyUncategorized(apiKey, baseUrl, model, req.user.id, onlyRules);
        res.json(result);
    } catch (error: any) {
        console.error("Classification Route Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

/**
 * @route   POST /api/classification/suggest-rules
 * @desc    Generates rule suggestions using LLM based on uncategorized transactions
 * @access  Private
 */
router.post("/suggest-rules", async (req: any, res: Response) => {
    try {
        let { apiKey, baseUrl, model, provider } = req.body;

        // If no API Key provided, fetch from Integrations settings
        if (!apiKey) {
            let rows;
            if (provider) {
                const sql = `
                    SELECT api_key, model, provider 
                    FROM llm_settings 
                    WHERE user_id = $1 AND provider = $2 AND is_active = true
                `;
                const res = await query(sql, [req.user.id, provider]);
                rows = res.rows;
            } else {
                const sql = `
                    SELECT api_key, model, provider 
                    FROM llm_settings 
                    WHERE user_id = $1 AND is_active = true
                    ORDER BY updated_at DESC
                    LIMIT 1
                `;
                const res = await query(sql, [req.user.id]);
                rows = res.rows;
            }

            if (rows.length > 0) {
                apiKey = rows[0].api_key;
                if (!model) model = rows[0].model;
                provider = rows[0].provider;
            }
        }

        const currentProvider = provider || 'openai';
        if (!baseUrl) {
            baseUrl = providerUrls[currentProvider] || providerUrls['openai'];
        }
        if (!model) {
            model = defaultModels[currentProvider] || 'gpt-4o';
        }

        const result = await classificationService.suggestRules(apiKey, baseUrl, model, req.user.id);
        res.json(result);
    } catch (error: any) {
        console.error("Suggest Rules Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

module.exports = router;
