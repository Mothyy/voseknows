import express = require("express");
import { Request, Response } from "express";
const router = express.Router();
const { query } = require("../db");
const auth = require("../middleware/auth");

router.use(auth);

/**
 * @route   GET /api/accounts
 * @desc    Get all accounts
 * @access  Public
 */
router.get("/", async (req: any, res: Response) => {
    try {
        const showInactive = req.query.showInactive === 'true';

        const sql = `
            SELECT
                a.id,
                a.name,
                LOWER(a.type) as type,
                a.balance as starting_balance,
                (a.balance + COALESCE(SUM(t.amount), 0))::numeric(15, 2) as balance,
                a.include_in_budget,
                a.is_active,
                a.interest_rate,
                a.interest_start_date,
                a.interest_type,
                a.last_interest_applied_at
            FROM accounts a
            LEFT JOIN transactions t ON a.id = t.account_id
            WHERE a.user_id = $1 ${showInactive ? '' : 'AND a.is_active = TRUE'}
            GROUP BY a.id
            ORDER BY a.name ASC;
        `;
        const { rows } = await query(sql, [(req as any).user.id]);

        // Process interest for loan accounts
        const processedRows = await applyLoanInterest(rows, (req as any).user.id);
        res.json(processedRows);
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
router.post("/", async (req: any, res: Response) => {
    const { name, type, balance, include_in_budget, is_active } = req.body;

    if (!name || !type) {
        return res
            .status(400)
            .json({ error: "Missing required fields: name, type" });
    }

    try {
        const { interest_rate, interest_start_date, interest_type } = req.body;
        // We treat the initial provided balance as the starting_balance
        const sql = `
            INSERT INTO accounts (name, type, balance, include_in_budget, is_active, user_id, interest_rate, interest_start_date, interest_type)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, LOWER(type) as type, balance as starting_balance, balance, include_in_budget, is_active, interest_rate, interest_start_date, interest_type, last_interest_applied_at;
        `;
        const { rows } = await query(sql, [
            name,
            type.toLowerCase(),
            balance || 0,
            include_in_budget !== false,
            is_active !== false, // Default to true
            (req as any).user.id,
            interest_rate || 0,
            interest_start_date || null,
            interest_type || 'compound'
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
router.get("/:id", async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT
                a.id,
                a.name,
                a.type,
                a.balance as starting_balance,
                (a.balance + COALESCE(SUM(t.amount), 0))::numeric(15, 2) as balance,
                COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0)::numeric(15, 2) as total_income,
                COALESCE(SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END), 0)::numeric(15, 2) as total_expenses,
                COUNT(t.id) as transaction_count,
                a.include_in_budget,
                a.is_active,
                a.interest_rate,
                a.interest_start_date,
                a.interest_type,
                a.last_interest_applied_at
            FROM accounts a
            LEFT JOIN transactions t ON a.id = t.account_id
            WHERE a.id = $1 AND a.user_id = $2
            GROUP BY a.id;
        `;
        const { rows } = await query(sql, [id, (req as any).user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Account not found" });
        }

        const processedRows = await applyLoanInterest(rows, (req as any).user.id);
        res.json(processedRows[0]);
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
router.get("/:id/transactions", async (req: any, res: Response) => {
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
            WHERE t.account_id = $1 AND a.user_id = $2
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT $3;
        `;
        const { rows } = await query(sql, [id, (req as any).user.id, limit]);
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
router.patch("/:id", async (req: any, res: Response) => {
    const { id } = req.params;
    const { name, type, balance, include_in_budget, is_active } = req.body;

    if (
        name === undefined &&
        type === undefined &&
        balance === undefined &&
        include_in_budget === undefined &&
        is_active === undefined &&
        req.body.interest_rate === undefined &&
        req.body.interest_start_date === undefined &&
        req.body.interest_type === undefined
    ) {
        return res.status(400).json({ error: "No fields to update provided" });
    }

    try {
        const currentResult = await query(
            "SELECT * FROM accounts WHERE id = $1 AND user_id = $2",
            [id, (req as any).user.id],
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
                    : currentAccount.balance,
            include_in_budget:
                include_in_budget !== undefined
                    ? include_in_budget
                    : currentAccount.include_in_budget,
            is_active: is_active !== undefined ? is_active : currentAccount.is_active,
            interest_rate: req.body.interest_rate !== undefined ? req.body.interest_rate : currentAccount.interest_rate,
            interest_start_date: req.body.interest_start_date !== undefined ? (req.body.interest_start_date || null) : currentAccount.interest_start_date,
            interest_type: req.body.interest_type !== undefined ? req.body.interest_type : currentAccount.interest_type
        };

        const sql = `
            UPDATE accounts
            SET name = $1, type = $2, balance = $3, include_in_budget = $4, is_active = $5, interest_rate = $8, interest_start_date = $9, interest_type = $10
            WHERE id = $6 AND user_id = $7
            RETURNING id, name, LOWER(type) as type, balance as starting_balance, balance, include_in_budget, is_active, interest_rate, interest_start_date, interest_type, last_interest_applied_at;
        `;

        const { rows } = await query(sql, [
            updatedAccount.name,
            updatedAccount.type.toLowerCase(),
            updatedAccount.starting_balance,
            updatedAccount.include_in_budget,
            updatedAccount.is_active,
            id,
            (req as any).user.id,
            updatedAccount.interest_rate,
            updatedAccount.interest_start_date,
            updatedAccount.interest_type
        ]);

        // Helper to compare dates safely
        const datesEqual = (d1: any, d2: any) => {
            if (!d1 && !d2) return true;
            if (!d1 || !d2) return false;
            try {
                return new Date(d1).toISOString().split('T')[0] === new Date(d2).toISOString().split('T')[0];
            } catch (e) {
                return false;
            }
        };

        const interestSettingsChanged =
            (req.body.interest_rate !== undefined && parseFloat(req.body.interest_rate) !== parseFloat(currentAccount.interest_rate)) ||
            (req.body.interest_start_date !== undefined && !datesEqual(req.body.interest_start_date, currentAccount.interest_start_date)) ||
            (req.body.interest_type !== undefined && req.body.interest_type !== currentAccount.interest_type);

        if (interestSettingsChanged) {
            // Delete all interest transactions for this account to allow full recalculation
            await query(
                "DELETE FROM transactions WHERE account_id = $1 AND user_id = $2 AND provider_transaction_id LIKE $3",
                [id, (req as any).user.id, `interest-${id}-%`]
            );
            // Reset last_interest_applied_at in DB
            await query(
                "UPDATE accounts SET last_interest_applied_at = NULL WHERE id = $1",
                [id]
            );
            // Update the rows object for the immediate response
            rows[0].last_interest_applied_at = null;

            // If interest is now disabled (rate 0 or no date), we just return the refreshed account
            if (parseFloat(updatedAccount.interest_rate) === 0 || !updatedAccount.interest_start_date) {
                const refreshSql = `
                    SELECT
                        a.id, a.name, LOWER(a.type) as type, a.balance as starting_balance,
                        (a.balance + COALESCE(SUM(t.amount), 0))::numeric(15, 2) as balance,
                        a.include_in_budget, a.is_active, a.interest_rate, a.interest_start_date, a.interest_type, a.last_interest_applied_at
                    FROM accounts a
                    LEFT JOIN transactions t ON a.id = t.account_id
                    WHERE a.id = $1 AND a.user_id = $2
                    GROUP BY a.id;
                `;
                const refreshed = await query(refreshSql, [id, (req as any).user.id]);
                return res.json(refreshed.rows[0]);
            }
        }

        const processedRows = await applyLoanInterest(rows, (req as any).user.id);
        res.json(processedRows[0]);
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
 * @route   DELETE /api/accounts/:id/transactions
 * @desc    Delete all transactions for a specific account
 * @access  Public
 */
router.delete("/:id/transactions", async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query(
            "DELETE FROM transactions WHERE account_id = $1 AND user_id = $2",
            [id, (req as any).user.id],
        );
        res.json({
            message: `Successfully deleted ${rowCount} transactions.`,
            deletedCount: rowCount,
        });
    } catch (err: any) {
        console.error(`Error deleting transactions for account ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/accounts/:id/category-summary
 * @desc    Get expenditure summary by category for an account
 * @access  Public
 */
router.get("/:id/category-summary", async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT
                COALESCE(c.name, 'Uncategorized') as name,
                ABS(SUM(t.amount))::numeric(15, 2) as value
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.account_id = $1 AND t.user_id = $2 AND t.amount < 0
            GROUP BY c.name
            ORDER BY value DESC;
        `;
        const { rows } = await query(sql, [id, (req as any).user.id]);
        res.json(rows);
    } catch (err: any) {
        console.error(
            `Error fetching category summary for account ${id}:`,
            err,
        );
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/accounts/:id/history
 * @desc    Get daily expenditure history for an account
 * @access  Public
 */
router.get("/:id/history", async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT
                date,
                ABS(SUM(amount))::numeric(15, 2) as amount
            FROM transactions
            WHERE account_id = $1 AND user_id = $2 AND amount < 0
            GROUP BY date
            ORDER BY date ASC;
        `;
        const { rows } = await query(sql, [id, (req as any).user.id]);
        res.json(rows);
    } catch (err: any) {
        console.error(`Error fetching history for account ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/accounts/:id
 * @desc    Delete an account
 * @access  Public
 */
router.delete("/:id", async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query("DELETE FROM accounts WHERE id = $1 AND user_id = $2", [
            id,
            (req as any).user.id
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

/**
 * @route   POST /api/accounts/:id/balance-adjustment
 * @desc    Create a balancing transaction to force the account balance to a target value on a specific date.
 * @access  Public
 */
router.post("/:id/balance-adjustment", async (req: any, res: Response) => {
    const { id } = req.params;
    const { date, targetBalance } = req.body;

    if (!date || targetBalance === undefined) {
        return res
            .status(400)
            .json({ error: "Missing required fields: date, targetBalance" });
    }

    try {
        // 1. Get Account Starting Balance
        const accountRes = await query(
            "SELECT balance FROM accounts WHERE id = $1 AND user_id = $2",
            [id, (req as any).user.id]
        );

        if (accountRes.rows.length === 0) {
            return res.status(404).json({ error: "Account not found" });
        }

        const startingBalance = parseFloat(accountRes.rows[0].balance);

        // 2. Get Sum of Transactions up to and including Date
        const sumRes = await query(
            "SELECT SUM(amount) as total FROM transactions WHERE account_id = $1 AND date <= $2 AND user_id = $3",
            [id, date, (req as any).user.id]
        );

        const currentSum = parseFloat(sumRes.rows[0].total || "0");
        const currentBalance = startingBalance + currentSum;

        // 3. Calculate Difference
        const diff = parseFloat(targetBalance) - currentBalance;

        // Round difference to 2 decimal places to avoid float precision issues
        const diffRounded = Math.round(diff * 100) / 100;

        if (Math.abs(diffRounded) < 0.01) {
            return res.json({ message: "Balance is already correct", adjustment: 0 });
        }

        // 4. Insert Balancing Transaction
        const description = "Manual Balance Adjustment";
        const fitId = `manual-adj-${id}-${Date.now()}`;

        const insertRes = await query(
            `INSERT INTO transactions
            (account_id, provider_transaction_id, date, description, amount, status, user_id)
            VALUES ($1, $2, $3, $4, $5, 'cleared', $6)
            RETURNING id, amount, date`,
            [id, fitId, date, description, diffRounded, (req as any).user.id]
        );

        res.status(201).json({
            message: "Adjustment transaction created",
            transaction: insertRes.rows[0],
            oldBalance: currentBalance,
            newBalance: currentBalance + diffRounded
        });

    } catch (err: any) {
        console.error(`Error creating balance adjustment for account ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/accounts/:id/recalculate-interest
 * @desc    Manually trigger interest calculation for a loan account
 * @access  Public
 */
router.post("/:id/recalculate-interest", async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT
                a.id,
                a.name,
                a.type,
                a.balance as starting_balance,
                (a.balance + COALESCE(SUM(t.amount), 0))::numeric(15, 2) as balance,
                a.include_in_budget,
                a.is_active,
                a.interest_rate,
                a.interest_start_date,
                a.interest_type,
                a.last_interest_applied_at
            FROM accounts a
            LEFT JOIN transactions t ON a.id = t.account_id
            WHERE a.id = $1 AND a.user_id = $2
            GROUP BY a.id;
        `;
        const { rows } = await query(sql, [id, (req as any).user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Account not found" });
        }

        const processedRows = await applyLoanInterest(rows, (req as any).user.id);
        res.json({
            message: "Interest recalculated successfully",
            account: processedRows[0]
        });
    } catch (err: any) {
        console.error(`Error recalculating interest for account ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * Helper to apply interest to loan accounts
 */
async function applyLoanInterest(accounts: any[], userId: string) {
    const processedAccounts = [...accounts];
    const today = new Date();
    // Use UTC for consistent month boundaries
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    for (let i = 0; i < processedAccounts.length; i++) {
        const account = processedAccounts[i];

        if (account.type === 'loan' && parseFloat(account.interest_rate) > 0 && account.interest_start_date) {
            let lastApplied = account.last_interest_applied_at
                ? new Date(account.last_interest_applied_at)
                : new Date(account.interest_start_date);

            // Ensure we are working with UTC dates and start at the beginning of the next month
            let currentMonth = new Date(Date.UTC(lastApplied.getUTCFullYear(), lastApplied.getUTCMonth() + 1, 1));

            let addedInterest = 0;
            let lastAppliedDateStr = account.last_interest_applied_at;
            while (currentMonth <= todayUtc) {
                const dateStr = currentMonth.toISOString().split('T')[0];
                const fitId = `interest-${account.id}-${dateStr}`;

                // Calculate interest for this month based on the balance BEFORE this month's interest
                // For 'simple' interest, we use the original starting balance
                // For 'compound' interest, we use the total balance so far
                const baseBalanceForCalculation = account.interest_type === 'simple'
                    ? parseFloat(account.starting_balance)
                    : (parseFloat(account.balance) + addedInterest);

                const monthlyInterest = Math.round(Math.abs(baseBalanceForCalculation) * (parseFloat(account.interest_rate) / 100 / 12) * 100) / 100;

                if (monthlyInterest > 0) {
                    try {
                        const existing = await query(
                            "SELECT id FROM transactions WHERE account_id = $1 AND provider_transaction_id = $2",
                            [account.id, fitId]
                        );

                        if (existing.rows.length === 0) {
                            await query(
                                `INSERT INTO transactions 
                                (account_id, provider_transaction_id, date, description, amount, status, user_id)
                                VALUES ($1, $2, $3, $4, $5, 'cleared', $6)`,
                                [account.id, fitId, dateStr, "Interest Charge", -monthlyInterest, userId]
                            );
                            addedInterest -= monthlyInterest;
                        }

                        // Mark this month as successfully verified/applied
                        lastAppliedDateStr = dateStr;
                    } catch (err) {
                        console.error(`Error applying interest for ${account.name} on ${dateStr}:`, err);
                        break;
                    }
                }

                currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
            }

            if (lastAppliedDateStr && lastAppliedDateStr !== account.last_interest_applied_at) {
                await query(
                    "UPDATE accounts SET last_interest_applied_at = $1 WHERE id = $2",
                    [lastAppliedDateStr, account.id]
                );
                account.last_interest_applied_at = lastAppliedDateStr;
                // Update the balance in the returned object to include the newly added interest
                account.balance = (parseFloat(account.balance) + addedInterest).toFixed(2);
            }
        }
    }

    return processedAccounts;
}

module.exports = router;
