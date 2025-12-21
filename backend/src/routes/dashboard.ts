import express = require("express");
import { Request, Response } from "express";
const router = express.Router();
const { query } = require("../db");

/**
 * @route   GET /api/dashboard
 * @desc    Get dashboard summary data
 * @access  Public
 */
router.get("/", async (req: Request, res: Response) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res
            .status(400)
            .json({ error: "Start and end dates are required" });
    }

    try {
        const [summary, worthOverTime, categoryVariance] = await Promise.all([
            getSummary(start as string, end as string),
            getWorthOverTime(start as string, end as string),
            getCategoryVariance(start as string, end as string),
        ]);

        res.json({
            ...summary,
            worthOverTime,
            categoryVariance,
        });
    } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

async function getSummary(startDate: string, endDate: string) {
    const sql = `
        WITH total_actuals AS (
            SELECT SUM(t.amount) as total_actual
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date >= $1 AND t.date <= $2
              AND a.include_in_budget = true
              AND t.category_id IS NOT NULL
        ),
        total_budgets AS (
            SELECT SUM(amount) as total_budget
            FROM budgets
            WHERE month >= $1 AND month <= $2
        )
        SELECT
            COALESCE((SELECT total_budget FROM total_budgets), 0)::numeric(15, 2) as "totalBudget",
            COALESCE((SELECT total_actual FROM total_actuals), 0)::numeric(15, 2) as "totalSpend"
    `;

    const { rows } = await query(sql, [startDate, endDate]);
    const summary = rows[0];
    const variance = summary.totalBudget + summary.totalSpend;

    return {
        totalSpend: parseFloat(summary.totalSpend),
        totalBudget: parseFloat(summary.totalBudget),
        variance: parseFloat(variance.toFixed(2)),
    };
}

async function getWorthOverTime(startDate: string, endDate: string) {
    // 1. Get total starting balance of all accounts
    const startingRes = await query(
        `SELECT SUM(starting_balance) as total FROM accounts`,
        [],
    );
    const initialBase = parseFloat(startingRes.rows[0].total || "0");

    // 2. Get net change from transactions BEFORE startDate
    const preHistoryRes = await query(
        `SELECT SUM(amount) as total FROM transactions WHERE date < $1`,
        [startDate],
    );
    const preHistoryChange = parseFloat(preHistoryRes.rows[0].total || "0");

    let currentBalance = initialBase + preHistoryChange;

    // 3. Get daily changes within the range
    const historySql = `
        WITH date_series AS (
            SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS day
        ),
        daily_changes AS (
            SELECT date, SUM(amount) as change
            FROM transactions
            WHERE date >= $1 AND date <= $2
            GROUP BY date
        )
        SELECT
            ds.day as date,
            COALESCE(dc.change, 0) as change
        FROM date_series ds
        LEFT JOIN daily_changes dc ON ds.day = dc.date
        ORDER BY ds.day ASC
    `;

    const { rows } = await query(historySql, [startDate, endDate]);

    // Calculate running total
    const history = rows.map((row: any) => {
        currentBalance += parseFloat(row.change);
        const dateStr = new Date(row.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
        return {
            name: dateStr,
            worth: parseFloat(currentBalance.toFixed(2)),
            budget: 0, // Budget is not part of wealth history
        };
    });

    return history;
}

async function getCategoryVariance(startDate: string, endDate: string) {
    const sql = `
        WITH range_actuals AS (
            SELECT category_id, SUM(amount) as actual
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date >= $1 AND t.date <= $2
            AND a.include_in_budget = true
            GROUP BY category_id
        ),
        range_budgets AS (
            SELECT category_id, SUM(amount) as budget
            FROM budgets
            WHERE month >= $1 AND month <= $2
            GROUP BY category_id
        )
        SELECT
            c.name as name,
            (COALESCE(b.budget, 0) + COALESCE(a.actual, 0))::numeric(15,2) as variance
        FROM categories c
        LEFT JOIN range_budgets b ON c.id = b.category_id
        LEFT JOIN range_actuals a ON c.id = a.category_id
        WHERE COALESCE(b.budget, 0) > 0 OR COALESCE(a.actual, 0) != 0
        ORDER BY variance ASC
    `;

    const { rows } = await query(sql, [startDate, endDate]);
    return rows.map((row: any) => ({
        name: row.name,
        variance: parseFloat(row.variance),
    }));
}

module.exports = router;
