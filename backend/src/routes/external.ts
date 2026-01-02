import express = require("express");
import type { Response } from "express";
const { query } = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

// All external routes require authentication (works with JWT or API Key)
router.use(auth);

/**
 * @route   GET /api/external/accounts
 * @desc    List all accounts with their IDs (useful for scripts)
 */
router.get("/accounts", async (req: any, res: Response) => {
    try {
        const { rows } = await query(
            "SELECT id, name, type FROM accounts WHERE user_id = $1 ORDER BY name ASC",
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error("External API Error (accounts):", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/external/categories
 * @desc    List all categories with their IDs
 */
router.get("/categories", async (req: any, res: Response) => {
    try {
        const { rows } = await query(
            "SELECT id, name, parent_id FROM categories WHERE user_id = $1 ORDER BY name ASC",
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error("External API Error (categories):", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/external/transactions
 * @desc    Upload one or more transactions. 
 *          Accepts a single transaction object or an array of objects.
 *          Tries to resolve account_name/category_name if IDs are missing.
 */
router.post("/transactions", async (req: any, res: Response) => {
    const userId = req.user.id;
    let transactions = Array.isArray(req.body) ? req.body : [req.body];

    if (transactions.length === 0) {
        return res.status(400).json({ error: "No transactions provided" });
    }

    const results = [];
    const errors = [];

    // Cache accounts and categories for this request to speed up name lookups
    const accountCache = new Map();
    const categoryCache = new Map();

    try {
        for (let i = 0; i < transactions.length; i++) {
            const txn = transactions[i];
            let { account_id, account_name, category_id, category_name, date, description, amount, status } = txn;

            if (!date || !description || amount === undefined) {
                errors.push({ index: i, error: "Missing required fields: date, description, amount" });
                continue;
            }

            // Resolve Account
            if (!account_id && account_name) {
                if (accountCache.has(account_name)) {
                    account_id = accountCache.get(account_name);
                } else {
                    const accRes = await query(
                        "SELECT id FROM accounts WHERE (name = $1 OR id::text = $1) AND user_id = $2",
                        [account_name, userId]
                    );
                    if (accRes.rows.length > 0) {
                        account_id = accRes.rows[0].id;
                        accountCache.set(account_name, account_id);
                    }
                }
            }

            if (!account_id) {
                errors.push({ index: i, error: "Account could not be resolved. Provide account_id or account_name." });
                continue;
            }

            // Resolve Category (optional)
            if (!category_id && category_name) {
                if (categoryCache.has(category_name)) {
                    category_id = categoryCache.get(category_name);
                } else {
                    const catRes = await query(
                        "SELECT id FROM categories WHERE (name = $1 OR id::text = $1) AND user_id = $2",
                        [category_name, userId]
                    );
                    if (catRes.rows.length > 0) {
                        category_id = catRes.rows[0].id;
                        categoryCache.set(category_name, category_id);
                    }
                }
            }

            // Insert Transaction
            try {
                const insertSql = `
                    INSERT INTO transactions (account_id, category_id, date, description, amount, status, user_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                `;
                const { rows } = await query(insertSql, [
                    account_id,
                    category_id || null,
                    date,
                    description,
                    amount,
                    status || "cleared", // Default to cleared for API uploads? Or pending? Frontend defaults to pending.
                    userId
                ]);
                results.push(rows[0]);
            } catch (err: any) {
                errors.push({ index: i, error: err.message });
            }
        }

        res.status(errors.length > 0 && results.length === 0 ? 400 : 201).json({
            success_count: results.length,
            error_count: errors.length,
            data: results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error("External API Error (transactions):", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
