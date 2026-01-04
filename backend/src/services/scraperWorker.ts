import { spawn } from "child_process";
import path = require("path");
import fs = require("fs");
const { query } = require("../db");
import { decrypt } from "../lib/encryption";

const processScraperExports = async (connection: any, scraperRoot: string, connectionId: string) => {
    const exportDir = path.join(scraperRoot, "exports");
    const { ImportService } = require("./importService");
    const importService = new ImportService();

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
                        // Remove prefix (slug_) case insensitive
                        const prefixRegex = new RegExp(`^${connection.scraper_slug}_`, 'i');
                        const cleanName = baseName.replace(prefixRegex, '');

                        for (const [remoteName, localId] of Object.entries(connection.accounts_map as Record<string, string>)) {
                            // Normalize remote key to match filename convention (spaces/slashes to underscores)
                            const normalized = remoteName.replace(/ /g, '_').replace(/\//g, '_');
                            if (normalized === cleanName) {
                                targetAccountId = localId;
                                console.log(`Mapped ${scraperFile} (${remoteName}) to local account ${localId}`);
                                break;
                            }
                        }
                    }

                    if (scraperFile.endsWith(".qif")) {
                        importResult = await importService.importQif(
                            fileData,
                            connection.user_id,
                            targetAccountId,
                            connection.date_format || 'YYYY-MM-DD'
                        );
                    } else {
                        importResult = await importService.importOfx(
                            fileData,
                            connection.user_id,
                            targetAccountId
                        );
                    }

                    console.log(`Import complete for ${scraperFile}:`, importResult);

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
    }
};

const handleScraperError = async (connectionId: string, errorMessage: string) => {
    await query(
        "UPDATE automated_connections SET status = 'error', last_error = $2 WHERE id = $1",
        [connectionId, errorMessage]
    );
    console.error(`Scraper error reported:`, errorMessage);
};

export const runScraper = async (connectionId: string) => {
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

        // 2. Update status to running
        await query(
            "UPDATE automated_connections SET status = 'running', last_run_at = NOW() WHERE id = $1",
            [connectionId]
        );

        // 3. Decrypt credentials
        const username = decrypt(connection.encrypted_username);
        const password = decrypt(connection.encrypted_password);

        let securityNumber = "";
        if (connection.encrypted_metadata) {
            try {
                const decryptedMetadata = decrypt(connection.encrypted_metadata);
                const metadata = JSON.parse(decryptedMetadata);
                if (metadata.securityNumber) {
                    securityNumber = metadata.securityNumber;
                }
            } catch (e) {
                console.error("Failed to decrypt or parse metadata:", e);
            }
        }

        // 4. Set up environment
        // Use the same scraper root (ActualAutomation) for export consistency
        const scraperRoot = process.env.SCRAPER_PATH || path.join(process.cwd(), "..", "ActualAutomation");

        // Branch: Native Node vs Python
        if (connection.scraper_slug === 'bom') {
            console.log("Using native Node.js scraper for BOM");
            const { ScraperService } = require('./ScraperService');

            const exportPath = path.join(scraperRoot, "exports");
            const config = {
                username,
                password,
                securityNumber,
                headless: true,
                exportPath
            };

            const scraper = ScraperService.getScraper('bom', config);
            try {
                await scraper.login();
                await scraper.downloadTransactions(); // Downloads to exportPath
                await scraper.close();
                console.log("BOM Scraper finished successfully");

                await processScraperExports(connection, scraperRoot, connectionId);
                console.log(`Scraper logic for ${connection.scraper_slug} completed.`);
            } catch (err: any) {
                console.error("BOM Node Scraper failed:", err);
                try { await scraper.close(); } catch (e) { }
                await handleScraperError(connectionId, `Node Scraper error: ${err.message}`);
            }

        } else {
            // Python Fallback
            const env: any = {
                ...process.env,
                [`${connection.scraper_slug.toUpperCase()}_USERNAME`]: username,
                [`${connection.scraper_slug.toUpperCase()}_PASSWORD`]: password,
                PYTHONPATH: scraperRoot
            };

            if (securityNumber) {
                env[`${connection.scraper_slug.toUpperCase()}_SECURITY_NUMBER`] = securityNumber;
            }

            const pythonScript = path.join(scraperRoot, "run_banks.py");
            const venvPython = "/opt/venv/bin/python3";
            const pythonCommand = fs.existsSync(venvPython) ? venvPython : "python3";

            console.log(`Spawning scraper: ${pythonCommand} ${pythonScript} ${connection.scraper_slug}`);

            const pythonProcess = spawn(pythonCommand, [pythonScript, connection.scraper_slug, "--headless"], {
                env,
                cwd: scraperRoot
            });

            let stdout = "";
            let stderr = "";

            // Add a timeout (5 minutes)
            const timeout = setTimeout(() => {
                console.error(`Scraper for ${connection.scraper_slug} timed out after 5 minutes. Killing process...`);
                pythonProcess.kill("SIGKILL");
            }, 300000);

            pythonProcess.on("error", async (err) => {
                clearTimeout(timeout);
                await handleScraperError(connectionId, `Scraper system error: ${err.message}`);
            });

            pythonProcess.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            pythonProcess.on("close", async (code) => {
                clearTimeout(timeout);
                console.log(`Scraper process exited with code ${code}`);

                if (code === 0) {
                    await processScraperExports(connection, scraperRoot, connectionId);
                    console.log(`Scraper for ${connection.scraper_slug} completed successfully.`);
                } else {
                    let errorMessage = stderr || "Scraper failed with unknown error";

                    if (code === null) {
                        errorMessage = "Scraper process timed out and was terminated.";
                    } else if (errorMessage.toLowerCase().includes("mfa") || errorMessage.toLowerCase().includes("secondary authentication")) {
                        errorMessage = "Bank requires MFA/Security Code. This scraper does not support interactive MFA yet.";
                    } else if (errorMessage.toLowerCase().includes("login") || errorMessage.toLowerCase().includes("credential")) {
                        errorMessage = "Invalid credentials. Please check your username and password.";
                    }

                    await handleScraperError(connectionId, errorMessage);
                }
            });
        }

    } catch (err: any) {
        console.error("Scraper Worker Error:", err);
        await handleScraperError(connectionId, err.message);
    }
};

/**
 * Poor man's scheduler - check for due tasks every minute
 */
export const startScheduler = () => {
    console.log("Starting scraping scheduler...");
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
