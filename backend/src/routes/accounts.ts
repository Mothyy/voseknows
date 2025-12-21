import express = require("express");
import { Request, Response } from "express";
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
            SELECT
                a.id,
                a.name,
                a.type,
                a.starting_balance,
                (a.starting_balance + COALESCE(SUM(t.amount), 0))::numeric(15, 2) as balance,
                a.include_in_budget
            FROM accounts a
            LEFT JOIN transactions t ON a.id = t.account_id
            GROUP BY a.id
            ORDER BY a.name ASC;
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
        // We treat the initial provided balance as the starting_balance
        const sql = `
            INSERT INTO accounts (name, type, starting_balance, include_in_budget)
                        VALUES ($1, $2, $3, $4)
            RETURNING id, name, type, starting_balance, starting_balance as balance, include_in_budget;
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
            SELECT
                a.id,
                a.name,
                a.type,
                a.starting_balance,
                (a.starting_balance + COALESCE(SUM(t.amount), 0))::numeric(15, 2) as balance,
                a.include_in_budget
            FROM accounts a
            LEFT JOIN transactions t ON a.id = t.account_id
            WHERE a.id = $1
            GROUP BY a.id;
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

/**
 * @route   PATCH /api/accounts/:id
 * @desc    Update an account
 * @access  Public
 */
router.patch("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, type, balance, include_in_budget } = req.body;

    if (
        name === undefined &&
        type === undefined &&
        balance === undefined &&
        include_in_budget === undefined
    ) {
        return res.status(400).json({ error: "No fields to update provided" });
    }

    try {
        const currentResult = await query(
            "SELECT * FROM accounts WHERE id = $1",
            [id],
        );
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: "Account not found" });
        }
        const currentAccount = currentResult.rows[0];

        const updatedAccount = {
            name: name !== undefined ? name : currentAccount.name,
            type: type !== undefined ? type : currentAccount.type,
            starting_balance:
                balance !== undefined
                    ? balance
                    : currentAccount.starting_balance,
            include_in_budget:
                include_in_budget !== undefined
                    ? include_in_budget
                    : currentAccount.include_in_budget,
        };

        const sql = `
            UPDATE accounts
            SET name = $1, type = $2, starting_balance = $3, include_in_budget = $4
            WHERE id = $5
            RETURNING id, name, type, starting_balance, starting_balance as balance, include_in_budget;
        `;

        const { rows } = await query(sql, [
            updatedAccount.name,
            updatedAccount.type,
            updatedAccount.starting_balance,
            updatedAccount.include_in_budget,
            id,
        ]);
        res.json(rows[0]);
    } catch (err: any) {
        console.error(`Error updating account ${id}:`, err);
        if (err.code === "23505") {
            return res
                .status(409)
                .json({ error: `Account with name '${name}' already exists.` });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/accounts/:id
 * @desc    Delete an account
 * @access  Public
 */
router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query("DELETE FROM accounts WHERE id = $1", [
            id,
        ]);
        if (rowCount === 0) {
            return res.status(404).json({ error: "Account not found" });
        }
        res.status(204).send();
    } catch (err: any) {
        console.error(`Error deleting account ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
