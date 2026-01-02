// Use `import = require()` for CommonJS compatibility with types
import express = require("express");
import type { Request, Response } from "express";

const router = express.Router();
const { query } = require("../db");
const auth = require("../middleware/auth");

router.use(auth);

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions with account and category information
 * @access  Private
 */
router.get("/", async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page as string) || 1;
        let limit = parseInt(req.query.limit as string) || 50;
        const search = (req.query.search as string) || "";
        const categoryId = req.query.categoryId as string;
        const accountId = req.query.accountId as string;

        if (search) {
            limit = 10000;
        }

        const offset = (page - 1) * limit;
        const params: any[] = [userId];
        const whereClauses: string[] = ["t.user_id = $1"];

        if (search) {
            params.push(`%${search}%`);
            whereClauses.push(`t.description ILIKE $${params.length}`);
        }

        if (accountId && accountId !== "all") {
            params.push(accountId);
            whereClauses.push(`t.account_id = $${params.length}`);
        }

        if (categoryId) {
            if (categoryId === "uncategorized") {
                whereClauses.push(`t.category_id IS NULL`);
            } else if (categoryId !== "all") {
                params.push(categoryId);
                whereClauses.push(`t.category_id IN (
                    WITH RECURSIVE category_tree AS (
                        SELECT id FROM categories WHERE id = $${params.length}
                        UNION ALL
                        SELECT c.id FROM categories c
                        JOIN category_tree ct ON c.parent_id = ct.id
                    )
                    SELECT id FROM category_tree
                )`);
            }
        }

        const whereSQL =
            whereClauses.length > 0
                ? `WHERE ${whereClauses.join(" AND ")}`
                : "";

        console.log("Fetching transactions:", {
            accountId,
            categoryId,
            search,
            whereSQL,
            params,
        });

        const countSql = `SELECT COUNT(*) as total FROM transactions t ${whereSQL}`;
        const countResult = await query(countSql, params);
        const total = parseInt(countResult.rows[0].total);

        const sql = `
            WITH balance_calc AS (
                SELECT
                    t.*,
                    (a.balance + SUM(t.amount) OVER (
                        PARTITION BY t.account_id
                        ORDER BY t.date ASC, t.created_at ASC
                    ))::numeric(15, 2) as balance
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
            )
            SELECT
                t.id,
                t.date,
                t.description,
                t.amount,
                t.status,
                a.name as account,
                c.name as category,
                t.category_id,
                t.account_id,
                t.balance
            FROM balance_calc t
            JOIN accounts a ON t.account_id = a.id
            LEFT JOIN categories c ON t.category_id = c.id
            ${whereSQL}
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2};
        `;
        const { rows } = await query(sql, [...params, limit, offset]);

        res.json({
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err: any) {
        console.error("Error fetching transactions:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/transactions/bulk-update
 * @desc    Bulk update transactions (e.g. categorize multiple)
 * @access  Public
 */
router.post("/bulk-update", async (req: any, res: Response) => {
    const { transactionIds, categoryId } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ error: "No transaction IDs provided" });
    }

    try {
        const sql = `
            UPDATE transactions
            SET category_id = $1
            WHERE id = ANY($2::uuid[]) AND user_id = $3
        `;
        const { rowCount } = await query(sql, [
            categoryId || null,
            transactionIds,
            req.user.id
        ]);

        res.json({ message: `Successfully updated ${rowCount} transactions` });
    } catch (err: any) {
        console.error("Error bulk updating transactions:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get a single transaction by its ID
 * @access  Public
 */
router.get("/:id", async (req: any, res: Response) => {
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
            WHERE t.id = $1 AND t.user_id = $2;
        `;
        const { rows } = await query(sql, [id, req.user.id]);
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
router.post("/", async (req: any, res: Response) => {
    const { account_id, category_id, date, description, amount, status } =
        req.body;

    if (!account_id || !date || !description || amount === undefined) {
        return res.status(400).json({
            error: "Missing required fields: account_id, date, description, amount",
        });
    }

    try {
        const sql = `
            INSERT INTO transactions (account_id, category_id, date, description, amount, status, user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const { rows } = await query(sql, [
            account_id,
            category_id,
            date,
            description,
            amount,
            status || "pending",
            req.user.id
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
router.patch("/:id", async (req: any, res: Response) => {
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
            "SELECT * FROM transactions WHERE id = $1 AND user_id = $2",
            [id, req.user.id],
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
            WHERE id = $6 AND user_id = $7
            RETURNING *;
        `;
        const { rows } = await query(sql, [
            updatedTxn.category_id,
            updatedTxn.description,
            updatedTxn.status,
            updatedTxn.date,
            updatedTxn.amount,
            id,
            req.user.id
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
router.delete("/:id", async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query(
            "DELETE FROM transactions WHERE id = $1 AND user_id = $2",
            [id, req.user.id],
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
