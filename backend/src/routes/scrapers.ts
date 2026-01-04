import express from "express";
const router = express.Router();
import { query } from "../db";
import { encrypt } from "../lib/encryption";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
const auth = require("../middleware/auth");
import { runScraper } from "../services/scraperWorker";
import { Response } from "express";

// Apply auth middleware to all routes
router.use(auth);

// @route   GET /api/scrapers
// @desc    Get all available scrapers
router.get("/", async (req: any, res: Response) => {
    try {
        const { rows } = await query("SELECT * FROM scrapers", []);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch scrapers" });
    }
});

// @route   GET /api/scrapers/connections
router.get("/connections", async (req: any, res: Response) => {
    try {
        const { rows } = await query(
            `SELECT c.id, c.name, c.status, c.last_run_at, c.last_error, c.account_id, c.date_format, c.encrypted_metadata, c.accounts_map,
    s.name as scraper_name, s.slug as scraper_slug,
    a.name as target_account_name,
    sch.frequency, sch.preferred_time
             FROM automated_connections c
             JOIN scrapers s ON c.scraper_id = s.id
             LEFT JOIN accounts a ON c.account_id = a.id
             LEFT JOIN scraping_schedules sch ON c.id = sch.connection_id
             WHERE c.user_id = $1`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err: any) {
        console.error("Fetch Connections Error:", err);
        if (err.stack) console.error(err.stack);
        res.status(500).json({ error: "Failed to fetch connections", details: err.message });
    }
});

router.post("/connections", async (req: any, res: Response) => {
    const { scraper_id, account_id, name, username, password, metadata, date_format, accounts_map } = req.body;

    if (!scraper_id || !name || !username || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const encryptedUsername = encrypt(username);
        const encryptedPassword = encrypt(password);
        const encryptedMetadata = metadata ? encrypt(JSON.stringify(metadata)) : null;

        const { rows } = await query(
            `INSERT INTO automated_connections
    (user_id, scraper_id, account_id, name, encrypted_username, encrypted_password, encrypted_metadata, date_format, accounts_map)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, name, status, created_at`,
            [req.user.id, scraper_id, account_id || null, name, encryptedUsername, encryptedPassword, encryptedMetadata, date_format || 'YYYY-MM-DD', accounts_map || '{}']
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error("Connection Creation Error:", err);
        res.status(500).json({ error: "Failed to create connection" });
    }
});

// @route   PUT /api/scrapers/connections/:id
router.put("/connections/:id", async (req: any, res: Response) => {
    const { id } = req.params;
    const { name, username, password, account_id, date_format, metadata, accounts_map } = req.body;

    try {
        // Fetch current values
        const current = await query("SELECT * FROM automated_connections WHERE id = $1 AND user_id = $2", [id, req.user.id]);
        if (current.rows.length === 0) return res.status(404).json({ error: "Connection not found" });

        const conn = current.rows[0];

        const updateName = name || conn.name;
        const updateUsername = username ? encrypt(username) : conn.encrypted_username;
        const updatePassword = password ? encrypt(password) : conn.encrypted_password;
        const updateAccountId = account_id !== undefined ? account_id : conn.account_id;
        const updateDateFormat = date_format || conn.date_format;
        const updateMetadata = metadata ? encrypt(JSON.stringify(metadata)) : conn.encrypted_metadata;
        const updateAccountsMap = accounts_map !== undefined ? accounts_map : conn.accounts_map;

        const { rows } = await query(
            `UPDATE automated_connections 
             SET name = $1, encrypted_username = $2, encrypted_password = $3,
    account_id = $4, date_format = $5, encrypted_metadata = $6, accounts_map = $7
             WHERE id = $8 AND user_id = $9
             RETURNING id, name, status`,
            [updateName, updateUsername, updatePassword, updateAccountId, updateDateFormat, updateMetadata, updateAccountsMap, id, req.user.id]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error("Update Connection Error:", err);
        res.status(500).json({ error: "Failed to update connection" });
    }
});

router.delete("/connections/:id", async (req: any, res: Response) => {
    try {
        await query("DELETE FROM scraping_schedules WHERE connection_id = $1", [req.params.id]);
        await query("DELETE FROM automated_connections WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
        res.json({ message: "Connection deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete connection" });
    }
});

router.post("/connections/:id/schedule", async (req: any, res: Response) => {
    const { frequency, is_active, preferred_time } = req.body;
    const connectionId = req.params.id;

    if (!frequency) return res.status(400).json({ error: "Frequency is required" });

    try {
        // Check if schedule exists
        const check = await query("SELECT id FROM scraping_schedules WHERE connection_id = $1", [connectionId]);

        if (check.rows.length > 0) {
            const { rows } = await query(
                `UPDATE scraping_schedules 
                 SET frequency = $1, is_active = $2, preferred_time = $4, next_run_at = NOW() 
                 WHERE connection_id = $3
                 RETURNING * `,
                [frequency, is_active !== undefined ? is_active : true, connectionId, preferred_time || null]
            );
            res.json(rows[0]);
        } else {
            const { rows } = await query(
                `INSERT INTO scraping_schedules (connection_id, frequency, is_active, preferred_time, next_run_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 RETURNING *`,
                [connectionId, frequency, true, preferred_time || null]
            );
            res.status(201).json(rows[0]);
        }
    } catch (err) {
        console.error("Schedule Update Error:", err);
        res.status(500).json({ error: "Failed to update schedule" });
    }
});

import { ScraperService } from "../services/ScraperService";

// @route   POST /api/scrapers/connections/test
// @desc    Test connection credentials and fetch accounts
router.post("/connections/test", async (req: any, res: Response) => {
    const { scraper_id, username, password, metadata } = req.body;

    if (!scraper_id || !username || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const scraperResult = await query("SELECT slug FROM scrapers WHERE id = $1", [scraper_id]);
        if (scraperResult.rows.length === 0) {
            return res.status(404).json({ error: "Scraper not found" });
        }
        const scraperSlug = scraperResult.rows[0].slug;

        // Use Node.js scraper for BOM and Greater Bank
        if (scraperSlug.toLowerCase() === 'bom' || scraperSlug.toLowerCase() === 'greater') {
            console.log(`Using Node.js ${scraperSlug} scraper for test...`);
            const scraper = ScraperService.getScraper(scraperSlug, {
                username,
                password,
                securityNumber: metadata?.securityNumber,
                headless: true
            });

            try {
                const loginSuccess = await scraper.login();
                if (loginSuccess) {
                    const accounts = await scraper.getAccounts();
                    await scraper.close();
                    return res.json({ success: true, accounts });
                } else {
                    await scraper.close();
                    return res.json({ success: false, error: "Login failed" });
                }
            } catch (err: any) {
                await scraper.close();
                console.error("Node scraper error:", err);
                return res.json({ success: false, error: err.message || "Scraper failed" });
            }
        }

        // Fallback to Python for other scrapers (e.g. ANZ) for now
        // Set up environment for Python
        const scraperRoot = process.env.SCRAPER_PATH || path.join(process.cwd(), "..", "ActualAutomation");
        const env: any = {
            ...process.env,
            [`${scraperSlug.toUpperCase()}_USERNAME`]: username,
            [`${scraperSlug.toUpperCase()}_PASSWORD`]: password,
            PYTHONPATH: scraperRoot
        };

        if (metadata && metadata.securityNumber) {
            env[`${scraperSlug.toUpperCase()}_SECURITY_NUMBER`] = metadata.securityNumber;
        }

        const pythonScript = path.join(scraperRoot, "run_banks.py");

        // Spawn Python process in test mode
        const pythonProcess = spawn("python3", [pythonScript, scraperSlug, "--headless", "--test"], {
            env,
            cwd: scraperRoot
        });

        let outputData = "";
        let errorData = "";

        pythonProcess.stdout.on("data", (data) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            errorData += data.toString();
        });

        pythonProcess.on("close", (code) => {
            if (code !== 0) {
                console.error("Test Scraper Error Output:", errorData);
                try {
                    const result = JSON.parse(outputData);
                    return res.status(400).json(result);
                } catch {
                    return res.status(500).json({ error: "Scraper failed to run", details: errorData });
                }
            }

            try {
                const jsonMatch = outputData.match(/\{.*\}/s);
                const result = JSON.parse(outputData.trim());
                res.json(result);
            } catch (e) {
                console.error("Failed to parse scraper output:", outputData);
                res.status(500).json({ error: "Invalid response from scraper", details: outputData });
            }
        });

    } catch (err) {
        console.error("Test Connection Error:", err);
        res.status(500).json({ error: "Failed to test connection" });
    }
});

// @route   POST /api/scrapers/connections/:id/run
router.post("/connections/:id/run", async (req: any, res: Response) => {
    try {
        // Check if it belongs to user
        const check = await query("SELECT id FROM automated_connections WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Connection not found" });

        // Trigger scraper (don't await for it to finish)
        runScraper(req.params.id);

        res.json({ message: "Scraper triggered successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to trigger scraper" });
    }
});

export default router;
