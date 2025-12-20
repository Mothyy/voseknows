import express = require("express");
import type { Request, Response } from "express";

const router = express.Router();
const { query } = require("../db");

/**
 * @route   GET /api/budgets
 * @desc    Get budget allocations for a specific month (list all categories with their budget)
 * @access  Public
 */
router.get("/", async (req: Request, res: Response) => {
    const month = req.query.month as string;

    if (!month) {
        return res.status(400).json({ error: "Month parameter is required (YYYY-MM-DD)" });
    }

    try {
        // We want to return all categories, and their budget for the month if it exists
        const sql = `
            SELECT
                c.id as category_id,
                c.name as category_name,
                c.parent_id,
                COALESCE(b.amount, 0) as budget_amount
            FROM categories c
            LEFT JOIN budgets b ON c.id = b.category_id AND b.month = $1
            ORDER BY c.name ASC;
        `;
        const { rows } = await query(sql, [month]);
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching budgets:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/budgets
 * @desc    Set/Update budget for a category and month
 * @access  Public
 */
router.post("/", async (req: Request, res: Response) => {
    const { category_id, month, amount } = req.body;

    if (!category_id || !month || amount === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const sql = `
            INSERT INTO budgets (category_id, month, amount)
            VALUES ($1, $2, $3)
            ON CONFLICT (category_id, month)
            DO UPDATE SET amount = EXCLUDED.amount
            RETURNING *;
        `;
        const { rows } = await query(sql, [category_id, month, amount]);
        res.json(rows[0]);
    } catch (err: any) {
        console.error("Error setting budget:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/budgets/report
 * @desc    Get budget vs actuals for a specific month
 * @access  Public
 */
router.get("/report", async (req: Request, res: Response) => {
    const month = req.query.month as string; // 'YYYY-MM-01'

    if (!month) {
        return res.status(400).json({ error: "Month parameter is required (YYYY-MM-DD)" });
    }

    try {
        // Calculate start and end date of the month for transaction filtering
        // Assuming 'month' passed is the first day of the month
        const startDate = new Date(month);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0); // Last day of month

        // Format for SQL
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const sql = `
            WITH monthly_actuals AS (
                SELECT
                    t.category_id,
                    SUM(t.amount) as actual_amount
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE t.date >= $1 AND t.date <= $2
                  AND a.include_in_budget = true
                  AND t.category_id IS NOT NULL
                GROUP BY t.category_id
            ),
            monthly_budgets AS (
                SELECT
                    category_id,
                    amount as budget_amount
                FROM budgets
                WHERE month = $3
            )
            SELECT
                c.id as category_id,
                c.name as category_name,
                c.parent_id,
                COALESCE(b.budget_amount, 0)::numeric(15, 2) as budget,
                COALESCE(a.actual_amount, 0)::numeric(15, 2) as actual
            FROM categories c
            LEFT JOIN monthly_budgets b ON c.id = b.category_id
            LEFT JOIN monthly_actuals a ON c.id = a.category_id
            ORDER BY c.name ASC;
        `;

        // Note: For parameter $3 (budget month), we expect exact date match if stored as date 'YYYY-MM-01'
        const { rows } = await query(sql, [startStr, endStr, month]);
        res.json(rows);

    } catch (err: any) {
        console.error("Error fetching budget report:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/budgets/summary
 * @desc    Get cumulative budget vs actuals since start date
 * @access  Public
 */
router.get("/summary", async (req: Request, res: Response) => {
    const startDate = req.query.startDate as string;

    if (!startDate) {
        return res.status(400).json({ error: "startDate parameter is required (YYYY-MM-DD)" });
    }

    try {
        const sql = `
            WITH total_actuals AS (
                SELECT
                    t.category_id,
                    SUM(t.amount) as total_actual
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE t.date >= $1
                  AND a.include_in_budget = true
                  AND t.category_id IS NOT NULL
                GROUP BY t.category_id
            ),
            total_budgets AS (
                SELECT
                    category_id,
                    SUM(amount) as total_budget
                FROM budgets
                WHERE month >= $1
                GROUP BY category_id
            )
            SELECT
                c.id as category_id,
                c.name as category_name,
                c.parent_id,
                COALESCE(b.total_budget, 0)::numeric(15, 2) as total_budget,
                COALESCE(a.total_actual, 0)::numeric(15, 2) as total_actual
            FROM categories c
            LEFT JOIN total_budgets b ON c.id = b.category_id
            LEFT JOIN total_actuals a ON c.id = a.category_id
            WHERE COALESCE(b.total_budget, 0) > 0 OR COALESCE(a.total_actual, 0) != 0
            ORDER BY c.name ASC;
        `;

        const { rows } = await query(sql, [startDate]);
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching budget summary:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
