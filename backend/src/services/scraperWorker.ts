import { ScraperService } from "./ScraperService";
import path = require("path");
import fs = require("fs");
const { query } = require("../db");
import { decrypt } from "../lib/encryption";

const processScraperExports = async (connection: any, scraperRoot: string, connectionId: string, exportDirOverride?: string) => {
    const exportDir = exportDirOverride || path.join(scraperRoot, "exports");
    const { ImportService } = require("./importService");
    const importService = new ImportService();
    let totalInserts = 0;
    let totalDuplicates = 0;

    try {
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const files = fs.readdirSync(exportDir);
        // Match file based on scraper slug (e.g. ANZ_Transactions.ofx)
        const scraperFiles = files.filter(f =>
            f.toLowerCase().includes(connection.scraper_slug.toLowerCase()) &&
            (f.endsWith(".ofx") || f.endsWith(".qfx") || f.endsWith(".qif"))
        );

        if (scraperFiles.length > 0) {
            console.log(`Found ${scraperFiles.length} file(s) for ${connection.scraper_slug}`);
            let successCount = 0;

            for (const scraperFile of scraperFiles) {
                try {
                    const filePath = path.join(exportDir, scraperFile);
                    const fileData = fs.readFileSync(filePath, "utf8");

                    console.log(`Importing data from ${scraperFile}...`);
                    let importResult;
                    let targetAccountId = connection.account_id;

                    // Attempt to resolve specific account from map
                    if (connection.accounts_map) {
                        const baseName = scraperFile.substring(0, scraperFile.lastIndexOf('.'));
                        const prefixRegex = new RegExp(`^${connection.scraper_slug}_`, 'i');
                        const cleanName = baseName.replace(prefixRegex, '');

                        console.log(`Mapping debug - File: ${cleanName}`);
                        const mapEntries = Object.entries(connection.accounts_map as Record<string, string>);

                        for (const [remoteName, localId] of mapEntries) {
                            // Normalize remote key to strict filename convention
                            const normalized = remoteName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
                            console.log(`Checking against: ${remoteName} -> ${normalized}`);

                            if (cleanName.toLowerCase().startsWith(normalized.toLowerCase())) {
                                targetAccountId = localId;
                                console.log(`Mapped ${scraperFile} matched ${remoteName}`);
                                break;
                            }
                        }

                        // Fallback: If no match found, but there is only ONE mapped account, use it.
                        if (!targetAccountId && mapEntries.length === 1) {
                            console.log("No exact filename match, but only one account mapped. Using it.");
                            targetAccountId = mapEntries[0][1];
                        }
                    }

                    if (scraperFile.endsWith(".qif")) {
                        let dateFormat = connection.date_format || 'YYYY-MM-DD';
                        // Force AU specific format for known scrapers
                        if (connection.scraper_slug === 'amex') {
                            dateFormat = 'DD/MM/YYYY';
                        }

                        importResult = await importService.importQif(
                            fileData,
                            connection.user_id,
                            targetAccountId,
                            dateFormat
                        );
                    } else {
                        importResult = await importService.importOfx(
                            fileData,
                            connection.user_id,
                            targetAccountId
                        );
                    }

                    console.log(`Import complete for ${scraperFile}:`, importResult);

                    // Aggregate stats
                    if (importResult && importResult.accounts) {
                        for (const accountStats of importResult.accounts) {
                            totalInserts += accountStats.inserted || 0;
                            totalDuplicates += accountStats.skipped || 0;
                        }
                    }

                    // Clean up
                    fs.unlinkSync(filePath);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to import file ${scraperFile}:`, err);
                }
            }

            await query(
                "UPDATE automated_connections SET status = 'idle', last_error = NULL WHERE id = $1",
                [connectionId]
            );
        } else {
            console.warn(`No export file found for ${connection.scraper_slug}`);
            await query(
                "UPDATE automated_connections SET status = 'idle', last_error = 'No data file found. Check scraper logs/credentials.' WHERE id = $1",
                [connectionId]
            );
        }
    } catch (importErr: any) {
        console.error("Import Error:", importErr);
        await query(
            "UPDATE automated_connections SET status = 'error', last_error = $2 WHERE id = $1",
            [connectionId, `Import failed: ${importErr.message}`]
        );
        throw importErr; // Re-throw to be caught by runScraper
    }

    return { inserts: totalInserts, duplicates: totalDuplicates };
};

const handleScraperError = async (connectionId: string, errorMessage: string) => {
    await query(
        "UPDATE automated_connections SET status = 'error', last_error = $2 WHERE id = $1",
        [connectionId, errorMessage]
    );
    console.error(`Scraper error reported:`, errorMessage);
};

export const runScraper = async (connectionId: string) => {
    let logId: string | null = null;
    try {
        // 1. Fetch connection details
        const { rows } = await query(
            `SELECT c.*, s.slug as scraper_slug 
             FROM automated_connections c
             JOIN scrapers s ON c.scraper_id = s.id
             WHERE c.id = $1`,
            [connectionId]
        );

        if (rows.length === 0) throw new Error("Connection not found");
        const connection = rows[0];

        // 2. Start Audit Log & Update Status
        const logRes = await query(
            `INSERT INTO scraper_logs (connection_id, status) VALUES ($1, 'running') RETURNING id`,
            [connectionId]
        );
        logId = logRes.rows[0].id;

        await query(
            "UPDATE automated_connections SET status = 'running', last_run_at = NOW() WHERE id = $1",
            [connectionId]
        );

        // Update schedule to prevent immediate re-run loops
        await query(
            `UPDATE scraping_schedules 
             SET next_run_at = CASE 
                WHEN preferred_time IS NOT NULL THEN
                    CASE 
                         WHEN frequency = 'weekly' THEN (((NOW() AT TIME ZONE COALESCE(timezone, 'UTC'))::date + INTERVAL '1 week' + preferred_time::time)::timestamp AT TIME ZONE COALESCE(timezone, 'UTC'))
                         ELSE (((NOW() AT TIME ZONE COALESCE(timezone, 'UTC'))::date + INTERVAL '1 day' + preferred_time::time)::timestamp AT TIME ZONE COALESCE(timezone, 'UTC'))
                    END
                WHEN frequency = 'weekly' THEN NOW() + INTERVAL '1 week'
                ELSE NOW() + INTERVAL '1 day'
             END
             WHERE connection_id = $1`,
            [connectionId]
        );

        // 3. Decrypt credentials
        const username = decrypt(connection.encrypted_username);
        const password = decrypt(connection.encrypted_password);

        let securityNumber = "";
        let enableLoanRedraw = false;
        if (connection.encrypted_metadata) {
            try {
                const decryptedMetadata = decrypt(connection.encrypted_metadata);
                const metadata = JSON.parse(decryptedMetadata);
                if (metadata.securityNumber) {
                    securityNumber = metadata.securityNumber;
                }
                if (metadata.enableLoanRedraw !== undefined) {
                    enableLoanRedraw = metadata.enableLoanRedraw;
                }
            } catch (e) {
                console.error("Failed to decrypt or parse metadata:", e);
            }
        }

        // 4. Set up environment
        const scraperRoot = process.cwd();

        console.log(`Using native Node.js scraper for ${connection.scraper_slug.toUpperCase()}`);

        const exportPath = path.join(scraperRoot, "exports", connectionId);

        const config = {
            username,
            password,
            securityNumber,
            enableLoanRedraw,
            headless: true,
            exportPath
        };

        const scraper = ScraperService.getScraper(connection.scraper_slug, config);
        let finalStats = { inserts: 0, duplicates: 0 };

        try {
            await scraper.login();

            // Sync Accounts from Scraper
            if (scraper.getAccounts) {
                const accounts = await scraper.getAccounts();
                if (accounts && accounts.length > 0) {
                    console.log(`Syncing ${accounts.length} accounts from scraper...`);
                    const accountsMap = connection.accounts_map as Record<string, string> || {};

                    for (const acc of accounts) {
                        if (typeof acc !== 'string') {
                            const providerId = acc.number || acc.id;
                            if (!providerId) continue;

                            const accountType = (acc.name.toLowerCase().includes('loan') || (acc.type === '3000')) ? 'LOAN' : 'BANK';
                            const mapKey = `${acc.name} (${acc.number})`;
                            let targetAccountId = accountsMap[mapKey];

                            if (!targetAccountId) {
                                const { rows: existing } = await query(
                                    `SELECT id FROM accounts WHERE provider_account_id = $1`,
                                    [providerId]
                                );
                                if (existing.length > 0) targetAccountId = existing[0].id;
                            }

                            if (!targetAccountId) {
                                console.log(`Creating new account: ${acc.name} (${acc.isVirtual ? 'Virtual' : 'Real'})`);
                                await query(
                                    `INSERT INTO accounts (
                                         id, user_id, name, type, provider_account_id, balance, available_balance, last_scraped_at
                                     ) VALUES (
                                         gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
                                     )`,
                                    [
                                        connection.user_id,
                                        acc.name,
                                        accountType,
                                        providerId,
                                        acc.balance || 0,
                                        acc.available || null
                                    ]
                                );
                            } else {
                                console.log(`Updating account: ${acc.name} (${targetAccountId})`);
                                const available = acc.available !== undefined ? acc.available : null;
                                let sql = `UPDATE accounts SET last_scraped_at = NOW(), available_balance = $2, provider_account_id = $3`;
                                const params: any[] = [targetAccountId, available, providerId];
                                let pIdx = 4;

                                if (acc.isVirtual) {
                                    sql += `, balance = $${pIdx}`;
                                    params.push(acc.balance || 0);
                                    pIdx++;
                                }

                                sql += ` WHERE id = $1`;
                                await query(sql, params);
                            }
                        }
                    }
                }
            }

            await scraper.downloadTransactions();
            await scraper.close();
            console.log(`${connection.scraper_slug.toUpperCase()} Scraper finished successfully`);

            // Returns { inserts, duplicates }
            finalStats = await processScraperExports(connection, scraperRoot, connectionId, exportPath);
            console.log(`Scraper logic for ${connection.scraper_slug} completed. Stats:`, finalStats);

            // Update Log success
            if (logId) {
                await query(
                    `UPDATE scraper_logs 
                     SET status = 'success', end_time = NOW(), inserts = $2, duplicates = $3 
                     WHERE id = $1`,
                    [logId, finalStats.inserts, finalStats.duplicates]
                );
            }

        } catch (err: any) {
            console.error("Node Scraper execution failed:", err);
            try { await scraper.close(); } catch (e) { }

            // Update Log failure (internal step)
            if (logId) {
                await query(
                    `UPDATE scraper_logs 
                     SET status = 'failed', end_time = NOW(), error_message = $2
                     WHERE id = $1`,
                    [logId, err.message]
                );
            }
            throw err; // Re-throw to be caught by outer catch for connection status update
        }

    } catch (err: any) {
        console.error("Scraper Worker Error:", err);
        // Ensure Log marked as failed if not already (in case validation failed before log created or after)
        if (logId) {
            try {
                await query(
                    `UPDATE scraper_logs 
                     SET status = 'failed', end_time = NOW(), error_message = $2 
                     WHERE id = $1 AND status = 'running'`,
                    [logId, err.message]
                );
            } catch (e) { }
        }
        await handleScraperError(connectionId, err.message);
    }
};

const ensureScrapers = async () => {
    try {
        await query(
            `INSERT INTO scrapers (name, slug, description) 
             VALUES ($1, $2, $3), ($4, $5, $6)
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
            [
                "Bank of Melbourne", "bom", "Scraper for Bank of Melbourne (Node.js)",
                "Greater Bank", "greater", "Scraper for Greater Bank (Node.js)"
            ]
        );
        console.log("Scrapers seeded successfully.");
    } catch (err) {
        console.error("Failed to seed scrapers:", err);
    }
};

/**
 * Poor man's scheduler - check for due tasks every minute
 */
export const startScheduler = () => {
    console.log("Starting scraping scheduler...");

    // Seed scrapers on startup
    ensureScrapers();

    // Reset any "running" connections to "idle" on startup (in case of crash/restart)
    query(
        "UPDATE automated_connections SET status = 'idle', last_error = 'System restart: execution interrupted' WHERE status = 'running'",
        []
    ).then(() => {
        console.log("Cleaned up stuck scraper statuses.");
    }).catch((err: any) => {
        console.error("Failed to clean up scraper statuses:", err);
    });

    setInterval(async () => {
        try {
            // Find connections with active schedules that are due
            const { rows } = await query(
                `SELECT c.id 
                 FROM automated_connections c
                 JOIN scraping_schedules s ON c.id = s.connection_id
                 WHERE s.is_active = true 
                 AND (s.next_run_at IS NULL OR s.next_run_at <= NOW())
                 AND c.status != 'running'`,
                []
            );

            for (const row of rows) {
                runScraper(row.id);
            }
        } catch (err) {
            console.error("Scheduler Error:", err);
        }
    }, 60000);
};
