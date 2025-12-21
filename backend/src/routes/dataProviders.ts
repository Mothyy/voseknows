import type { Request, Response } from "express";
const express = require("express");
const router = express.Router();
const { query, pool } = require("../db");
const createSissClient = require("../sissClient");

/**
 * @route   GET /api/data-providers
 * @desc    Get all available data providers
 * @access  Public
 */
router.get("/", async (req: Request, res: Response) => {
    try {
        const { rows } = await query(
            "SELECT id, name, slug FROM data_providers ORDER BY name ASC",
            [],
        );
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching data providers:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- Connection Management ---

/**
 * @route   POST /api/data-providers/connections
 * @desc    Create a new connection to a data provider (e.g., SISS)
 * @access  Public
 */
router.post("/connections", async (req: Request, res: Response) => {
    const { provider_slug, institution_name, api_key, customer_id } = req.body;

    if (!provider_slug || !institution_name || !api_key || !customer_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // Find the provider ID from the slug
        const providerResult = await query(
            "SELECT id FROM data_providers WHERE slug = $1",
            [provider_slug],
        );
        if (providerResult.rows.length === 0) {
            return res.status(404).json({ error: "Provider not found" });
        }
        const provider_id = providerResult.rows[0].id;

        // IMPORTANT: In a production environment, api_key MUST be encrypted before saving.
        // const encryptedApiKey = encrypt(api_key);

        const sql = `
            INSERT INTO provider_connections (provider_id, institution_name, api_key, customer_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, institution_name, last_sync_at;
        `;
        const { rows } = await query(sql, [
            provider_id,
            institution_name,
            api_key, // In production, use encryptedApiKey
            customer_id,
        ]);

        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error("Error creating provider connection:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/data-providers/connections
 * @desc    Get all existing provider connections
 * @access  Public
 */
router.get("/connections", async (req: Request, res: Response) => {
    try {
        const sql = `
            SELECT
                pc.id,
                pc.institution_name,
                pc.last_sync_at,
                dp.name as provider_name,
                dp.slug as provider_slug
            FROM provider_connections pc
            JOIN data_providers dp ON pc.provider_id = dp.id
            ORDER BY pc.created_at DESC;
        `;
        const { rows } = await query(sql, []);
        res.json(rows);
    } catch (err: any) {
        console.error("Error fetching provider connections:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/data-providers/connections/:id
 * @desc    Delete a provider connection
 * @access  Public
 */
router.delete("/connections/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const deleteSql = `DELETE FROM provider_connections WHERE id = $1 RETURNING id;`;
        const { rows } = await query(deleteSql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Connection not found" });
        }

        res.status(200).json({ message: "Connection deleted successfully" });
    } catch (err: any) {
        console.error(`Error deleting connection ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   GET /api/data-providers/connections/:id
 * @desc    Get a single provider connection by ID
 * @access  Public
 */
router.get("/connections/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT
                pc.id,
                pc.institution_name,
                pc.last_sync_at,
                dp.name as provider_name,
                dp.slug as provider_slug
            FROM provider_connections pc
            JOIN data_providers dp ON pc.provider_id = dp.id
            WHERE pc.id = $1;
        `;
        const { rows } = await query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Connection not found" });
        }

        res.json(rows[0]);
    } catch (err: any) {
        console.error(`Error fetching connection ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- Data Synchronization ---

/**
 * @route   POST /api/data-providers/connections/:id/sync
 * @desc    Trigger a manual sync of accounts and transactions for a connection
 * @access  Public
 */
router.post("/connections/:id/sync", async (req: Request, res: Response) => {
    const { id: connectionId } = req.params;
    console.log(`Starting sync for connection ID: ${connectionId}`);

    const client = await pool.connect();
    try {
        // Step 1: Fetch the connection details from our database
        console.log("Fetching connection details...");
        const connectionResult = await client.query(
            `SELECT pc.id, pc.api_key, pc.customer_id, dp.slug as provider_slug
             FROM provider_connections pc
             JOIN data_providers dp ON pc.provider_id = dp.id
             WHERE pc.id = $1`,
            [connectionId],
        );

        if (connectionResult.rows.length === 0) {
            console.error(`Connection with ID ${connectionId} not found.`);
            return res.status(404).json({ error: "Connection not found" });
        }
        const connection = connectionResult.rows[0];
        console.log(`Connection found: ${connection.institution_name}`);

        // IMPORTANT: In production, you would decrypt the api_key here.
        const { api_key, customer_id, provider_slug } = connection;

        // Step 2: Begin a database transaction
        console.log("Beginning database transaction...");
        await client.query("BEGIN");

        // Step 3: Use a switch to handle different providers
        if (provider_slug === "siss") {
            console.log("Processing SISS synchronization...");
            const sissClient = createSissClient(api_key, customer_id);

            // Fetch accounts from SISS
            console.log("Fetching accounts from SISS...");
            const accountsResponse = await sissClient.get(
                "/v1/sds/banking/accounts",
            );
            const sissAccounts = accountsResponse.data.data.accounts;
            console.log(`Found ${sissAccounts.length} accounts from SISS.`);

            // Upsert accounts into our database
            for (const acc of sissAccounts) {
                console.log(
                    `Upserting account: ${acc.displayName} (${acc.accountId})`,
                );
                const upsertAccountSql = `
                    INSERT INTO accounts (connection_id, provider_account_id, name, type)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (provider_account_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        type = EXCLUDED.type
                    RETURNING id;
                `;
                const { rows } = await client.query(upsertAccountSql, [
                    connectionId,
                    acc.accountId,
                    acc.displayName,
                    acc.productCategory.toLowerCase(),
                ]);
                const ourAccountId = rows[0].id;
                console.log(`Upserted account with local ID: ${ourAccountId}`);

                // Fetch transactions for this account from SISS
                console.log(
                    `Fetching transactions for account ID: ${acc.accountId}`,
                );
                const transactionsResponse = await sissClient.get(
                    `/v1/sds/banking/accounts/${acc.accountId}/transactions`,
                );
                const sissTransactions =
                    transactionsResponse.data.data.transactions;
                console.log(`Found ${sissTransactions.length} transactions.`);

                // Upsert transactions for this account
                let upsertedCount = 0;
                for (const tx of sissTransactions) {
                    const upsertTransactionSql = `
                        INSERT INTO transactions (account_id, provider_transaction_id, date, description, amount, status)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (provider_transaction_id) DO NOTHING;
                    `;
                    const result = await client.query(upsertTransactionSql, [
                        ourAccountId,
                        tx.transactionId,
                        tx.executionDateTime,
                        tx.description,
                        parseFloat(tx.amount),
                        tx.status.toLowerCase(),
                    ]);
                    if (result.rowCount > 0) {
                        upsertedCount++;
                    }
                }
                console.log(
                    `Upserted ${upsertedCount} new transactions for account ${acc.accountId}.`,
                );
            }
        } else {
            console.warn(
                `Provider slug '${provider_slug}' is not implemented.`,
            );
            return res
                .status(501)
                .json({ error: "Provider not yet implemented" });
        }

        // Step 4: Update the last_sync_at timestamp
        console.log("Updating last_sync_at timestamp...");
        await client.query(
            "UPDATE provider_connections SET last_sync_at = NOW() WHERE id = $1",
            [connectionId],
        );

        // Step 5: Commit the transaction
        console.log("Committing database transaction...");
        await client.query("COMMIT");

        console.log(
            `Sync for connection ${connectionId} completed successfully.`,
        );
        res.json({ message: "Synchronization completed successfully." });
    } catch (err: any) {
        await client.query("ROLLBACK");
        console.error(`Error during sync for connection ${connectionId}:`, err);
        // Check for specific axios error structure
        if (err.response) {
            console.error("Error data from provider:", err.response.data);
            return res.status(500).json({
                error: "Failed to fetch data from the provider.",
                providerError: err.response.data,
            });
        }
        res.status(500).json({ error: "Internal Server Error during sync" });
    } finally {
        client.release();
    }
});

module.exports = router;
