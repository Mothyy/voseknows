import express = require("express");
import { Request, Response } from "express";
const router = express.Router();
const { query } = require("../db");
const auth = require("../middleware/auth");

router.use(auth);

/**
 * @route   GET /api/dashboard
 * @desc    Get dashboard summary data
 * @access  Public
 */
router.get("/", async (req: any, res: Response) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res
            .status(400)
            .json({ error: "Start and end dates are required" });
    }

    try {
        const userId = req.user.id;
        const [summary, worthOverTime, categoryVariance] = await Promise.all([
            getSummary(start as string, end as string, userId),
            getWorthOverTime(start as string, end as string, userId),
            getCategoryVariance(start as string, end as string, userId),
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

async function getSummary(startDate: string, endDate: string, userId: string) {
    const sql = `
        WITH total_actuals AS (
            SELECT SUM(t.amount) as total_actual
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date >= $1 AND t.date <= $2
              AND a.include_in_budget = true
              AND t.category_id IS NOT NULL
              AND t.user_id = $3
        ),
        total_budgets AS (
            SELECT SUM(amount) as total_budget
            FROM budgets
            WHERE month >= $1 AND month <= $2
              AND user_id = $3
        )
        SELECT
            COALESCE((SELECT total_budget FROM total_budgets), 0)::numeric(15, 2) as "totalBudget",
            COALESCE((SELECT total_actual FROM total_actuals), 0)::numeric(15, 2) as "totalSpend"
    `;

    const { rows } = await query(sql, [startDate, endDate, userId]);
    const summary = rows[0];
    const totalBudget = parseFloat(summary.totalBudget);
    const totalSpend = parseFloat(summary.totalSpend);
    const variance = totalBudget + totalSpend;

    return {
        totalSpend,
        totalBudget,
        variance: parseFloat(variance.toFixed(2)),
    };
}

async function getWorthOverTime(startDate: string, endDate: string, userId: string) {
    // 1. Get CURRENT total balance of all accounts (snapshot)
    const currentRes = await query(
        `SELECT SUM(balance) as total FROM accounts WHERE user_id = $1`,
        [userId],
    );
    const currentBalance = parseFloat(currentRes.rows[0].total || "0");

    // 2. Get total change from startDate until NOW (to back-calculate)
    // We strictly use > or >= based on whether we want start-of-day or end-of-day.
    // To get Balance at Beginning of StartDate: Subtract ALL transactions >= StartDate
    const intervalChangeRes = await query(
        `SELECT SUM(amount) as total FROM transactions WHERE date >= $1 AND user_id = $2`,
        [startDate, userId],
    );
    const intervalChange = parseFloat(intervalChangeRes.rows[0].total || "0");

    // Back-calculate buffer: The balance at the exact moment before StartDate's first transaction
    let runningBalance = currentBalance - intervalChange;

    // 3. Get daily changes within the requested range for the graph
    const historySql = `
        WITH date_series AS (
            SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS day
        ),
        daily_changes AS (
            SELECT date, SUM(amount) as change
            FROM transactions
            WHERE date >= $1 AND date <= $2 AND user_id = $3
            GROUP BY date
        )
        SELECT
            ds.day as date,
            COALESCE(dc.change, 0) as change
        FROM date_series ds
        LEFT JOIN daily_changes dc ON ds.day = dc.date
        ORDER BY ds.day ASC
    `;

    const { rows } = await query(historySql, [startDate, endDate, userId]);

    // Calculate running total forward from the starting point
    const history = rows.map((row: any) => {
        const dailyChange = parseFloat(row.change);
        runningBalance += dailyChange;

        const dateStr = new Date(row.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });

        return {
            name: dateStr,
            worth: parseFloat(runningBalance.toFixed(2)),
            budget: 0,
        };
    });

    return history;
}

async function getCategoryVariance(startDate: string, endDate: string, userId: string) {
    const sql = `
        WITH range_actuals AS (
            SELECT category_id, SUM(amount) as actual
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date >= $1 AND t.date <= $2
            AND a.include_in_budget = true
            AND t.user_id = $3
            GROUP BY category_id
        ),
        range_budgets AS (
            SELECT category_id, SUM(amount) as budget
            FROM budgets
            WHERE month >= $1 AND month <= $2
            AND user_id = $3
            GROUP BY category_id
        )
        SELECT
            c.name as name,
            (COALESCE(b.budget, 0) + COALESCE(a.actual, 0))::numeric(15,2) as variance
        FROM categories c
        LEFT JOIN range_budgets b ON c.id = b.category_id
        LEFT JOIN range_actuals a ON c.id = a.category_id
        WHERE c.user_id = $3 AND (COALESCE(b.budget, 0) > 0 OR COALESCE(a.actual, 0) != 0)
        ORDER BY variance ASC
    `;

    const { rows } = await query(sql, [startDate, endDate, userId]);
    return rows.map((row: any) => ({
        name: row.name,
        variance: parseFloat(row.variance),
    }));
}

module.exports = router;
