import express = require("express");
import type { Request, Response } from "express";

const router = express.Router();
const { query } = require("../db");

/**
 * @route   GET /api/reports/budget-variance
 * @desc    Get budget vs actuals for a date range
 * @access  Public
 */
router.get("/budget-variance", async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res
            .status(400)
            .json({ error: "startDate and endDate are required" });
    }

    try {
        const sql = `
            WITH range_budgets AS (
                SELECT category_id, SUM(amount) as total_budget
                FROM budgets
                WHERE month >= $1 AND month <= $2
                GROUP BY category_id
            ),
            range_actuals AS (
                SELECT t.category_id, SUM(t.amount) as total_actual
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE t.date >= $1 AND t.date <= $2
                  AND a.include_in_budget = true
                  AND t.category_id IS NOT NULL
                GROUP BY t.category_id
            )
            SELECT
                c.id,
                c.name,
                COALESCE(b.total_budget, 0)::numeric(15, 2) as budget,
                COALESCE(a.total_actual, 0)::numeric(15, 2) as actual
            FROM categories c
            LEFT JOIN range_budgets b ON c.id = b.category_id
            LEFT JOIN range_actuals a ON c.id = a.category_id
            WHERE COALESCE(b.total_budget, 0) > 0 OR COALESCE(a.total_actual, 0) != 0
            ORDER BY c.name ASC;
        `;

        const { rows } = await query(sql, [startDate, endDate]);
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching budget variance:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/reports/wealth
 * @desc    Get daily total wealth over time
 * @access  Public
 */
router.get("/wealth", async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res
            .status(400)
            .json({ error: "startDate and endDate are required" });
    }

    try {
        // 1. Calculate the starting balance for all accounts prior to the startDate
        const initialBalanceSql = `
            SELECT
                SUM(a.starting_balance + COALESCE(t_sum.amount, 0)) as opening_balance
            FROM accounts a
            LEFT JOIN (
                SELECT account_id, SUM(amount) as amount
                FROM transactions
                WHERE date < $1
                GROUP BY account_id
            ) t_sum ON a.id = t_sum.account_id
        `;
        const initialRes = await query(initialBalanceSql, [startDate]);
        let currentBalance = parseFloat(
            initialRes.rows[0].opening_balance || "0",
        );

        // 2. Get daily net changes within the range
        const dailyChangesSql = `
            SELECT
                date,
                SUM(amount) as daily_change
            FROM transactions
            WHERE date >= $1 AND date <= $2
            GROUP BY date
            ORDER BY date ASC
        `;
        const changesRes = await query(dailyChangesSql, [startDate, endDate]);

        // 3. Construct the time series
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        // Normalize to noon to avoid timezone/DST issues when adding days
        start.setHours(12, 0, 0, 0);
        end.setHours(12, 0, 0, 0);

        const data = [];

        // Create a map for quick lookup
        const changesMap = new Map();
        changesRes.rows.forEach((row: any) => {
            const dStr = new Date(row.date).toISOString().split("T")[0];
            changesMap.set(dStr, parseFloat(row.daily_change));
        });

        // Loop through each day
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split("T")[0];
            const change = changesMap.get(dateStr) || 0;
            currentBalance += change;

            data.push({
                date: dateStr,
                balance: Number(currentBalance.toFixed(2)),
            });
        }

        res.json(data);
    } catch (err: any) {
        console.error("Error fetching wealth report:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
