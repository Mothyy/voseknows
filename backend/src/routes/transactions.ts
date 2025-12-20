// Use `import = require()` for CommonJS compatibility with types
import express = require("express");
import type { Request, Response } from "express";

const router = express.Router();
const { query } = require("../db");

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions with account and category information
 * @access  Public
 */
router.get("/", async (req: Request, res: Response) => {
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
            ORDER BY t.date DESC, t.created_at DESC;
        `;
        const { rows } = await query(sql, []);
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching transactions:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get a single transaction by its ID
 * @access  Public
 */
router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT
                t.id,
                t.date,
                t.description,
                t.amount,
                t.status,
                t.account_id,
                t.category_id
            FROM transactions t
            WHERE t.id = $1;
        `;
        const { rows } = await query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.json(rows[0]);
    } catch (err: any) {
        console.error(`Error fetching transaction ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/transactions
 * @desc    Create a new transaction
 * @access  Public
 */
router.post("/", async (req: Request, res: Response) => {
    const { account_id, category_id, date, description, amount, status } =
        req.body;

    if (!account_id || !date || !description || amount === undefined) {
        return res.status(400).json({
            error: "Missing required fields: account_id, date, description, amount",
        });
    }

    try {
        const sql = `
            INSERT INTO transactions (account_id, category_id, date, description, amount, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const { rows } = await query(sql, [
            account_id,
            category_id,
            date,
            description,
            amount,
            status || "pending",
        ]);
        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error("Error creating transaction:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   PATCH /api/transactions/:id
 * @desc    Update a transaction's details
 * @access  Public
 */
router.patch("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { category_id, description, status, date, amount } = req.body;

    if (
        [category_id, description, status, date, amount].every(
            (field) => field === undefined,
        )
    ) {
        return res.status(400).json({ error: "No fields to update provided" });
    }

    try {
        const currentResult = await query(
            "SELECT * FROM transactions WHERE id = $1",
            [id],
        );
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        const currentTxn = currentResult.rows[0];

        const updatedTxn = {
            ...currentTxn,
            category_id:
                category_id !== undefined
                    ? category_id
                    : currentTxn.category_id,
            description:
                description !== undefined
                    ? description
                    : currentTxn.description,
            status: status !== undefined ? status : currentTxn.status,
            date: date !== undefined ? date : currentTxn.date,
            amount: amount !== undefined ? amount : currentTxn.amount,
        };

        const sql = `
            UPDATE transactions
            SET category_id = $1, description = $2, status = $3, date = $4, amount = $5
            WHERE id = $6
            RETURNING *;
        `;
        const { rows } = await query(sql, [
            updatedTxn.category_id,
            updatedTxn.description,
            updatedTxn.status,
            updatedTxn.date,
            updatedTxn.amount,
            id,
        ]);
        res.json(rows[0]);
    } catch (err: any) {
        console.error(`Error updating transaction ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete a transaction
 * @access  Public
 */
router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query(
            "DELETE FROM transactions WHERE id = $1",
            [id],
        );
        if (rowCount === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.status(204).send();
    } catch (err: any) {
        console.error(`Error deleting transaction ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
