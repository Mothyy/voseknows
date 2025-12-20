import type { Request, Response } from "express";
const express = require("express");
const router = express.Router();
const { query } = require("../db");

/**
 * @route   GET /api/accounts
 * @desc    Get all accounts
 * @access  Public
 */
router.get("/", async (req: Request, res: Response) => {
    try {
        const sql = `
            SELECT id, name, type, balance, include_in_budget
            FROM accounts
            ORDER BY name ASC;
        `;
        const { rows } = await query(sql, []);
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching accounts:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/accounts
 * @desc    Create a new account
 * @access  Public
 */
router.post("/", async (req: Request, res: Response) => {
    const { name, type, balance, include_in_budget } = req.body;

    if (!name || !type) {
        return res
            .status(400)
            .json({ error: "Missing required fields: name, type" });
    }

    try {
        const sql = `
            INSERT INTO accounts (name, type, balance, include_in_budget)
                        VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const { rows } = await query(sql, [
            name,
            type,
            balance || 0,
            include_in_budget !== false,
        ]);
        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error("Error creating account:", err);
        // Handle unique constraint violation for the name
        if (err.code === "23505") {
            return res
                .status(409)
                .json({ error: `Account with name '${name}' already exists.` });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/accounts/:id
 * @desc    Get a single account by its ID
 * @access  Public
 */
router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT id, name, type, balance, include_in_budget
            FROM accounts
            WHERE id = $1;
        `;
        const { rows } = await query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Account not found" });
        }
        res.json(rows[0]);
    } catch (err: any) {
        console.error(`Error fetching account ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/accounts/:id/transactions
 * @desc    Get all transactions for a specific account
 * @access  Public
 */
router.get("/:id/transactions", async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = req.query.limit || 10; // Default to 10 transactions

    try {
        const sql = `
            SELECT
                t.id,
                t.date,
                t.description,
                t.amount,
                t.status,
                a.name as account,
                c.name as category,
                t.category_id,
                t.account_id
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.account_id = $1
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT $2;
        `;
        const { rows } = await query(sql, [id, limit]);
        res.json(rows);
    } catch (err: any) {
        console.error(`Error fetching transactions for account ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
