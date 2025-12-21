// @ts-ignore
import { parse } from "node-ofx-parser";
const { query } = require("../db");

interface ImportResult {
    accounts: {
        accountId: string;
        inserted: number;
        skipped: number;
    }[];
}

class ImportService {
    async importOfx(
        ofxData: string,
        targetAccountId?: string,
    ): Promise<ImportResult> {
        const parsedData = parse(ofxData);
        const result: ImportResult = { accounts: [] };

        // 1. Ensure Data Provider exists
        const providerName = "OFX Import";
        const providerSlug = "ofx-import";
        let providerId;

        const providerRes = await query(
            "SELECT id FROM data_providers WHERE slug = $1",
            [providerSlug],
        );
        if (providerRes.rows.length > 0) {
            providerId = providerRes.rows[0].id;
        } else {
            const newProvider = await query(
                "INSERT INTO data_providers (name, slug) VALUES ($1, $2) RETURNING id",
                [providerName, providerSlug],
            );
            providerId = newProvider.rows[0].id;
        }

        // 2. Ensure Provider Connection exists
        // Ideally we would extract institution name from OFX, but it's often missing or inconsistent.
        // We'll default to 'Manual Import' or try to find <ORG> tag if available.
        // For this implementation, we'll use a generic fallback.
        let institutionName = "Manual Import";
        try {
            if (parsedData.OFX.SIGNONMSGSRSV1?.SONRS?.FI?.ORG) {
                institutionName = parsedData.OFX.SIGNONMSGSRSV1.SONRS.FI.ORG;
            }
        } catch (e) {
            // ignore
        }

        let connectionId;
        const connectionRes = await query(
            "SELECT id FROM provider_connections WHERE provider_id = $1 AND institution_name = $2",
            [providerId, institutionName],
        );

        if (connectionRes.rows.length > 0) {
            connectionId = connectionRes.rows[0].id;
        } else {
            const newConnection = await query(
                `INSERT INTO provider_connections (provider_id, api_key, customer_id, institution_name)
                 VALUES ($1, 'manual', 'manual', $2) RETURNING id`,
                [providerId, institutionName],
            );
            connectionId = newConnection.rows[0].id;
        }

        const ofxRoot = parsedData.OFX;

        // Process Credit Cards
        if (ofxRoot.CREDITCARDMSGSRSV1) {
            const ccMsgs = Array.isArray(ofxRoot.CREDITCARDMSGSRSV1.CCSTMTTRNRS)
                ? ofxRoot.CREDITCARDMSGSRSV1.CCSTMTTRNRS
                : [ofxRoot.CREDITCARDMSGSRSV1.CCSTMTTRNRS];

            for (const msg of ccMsgs) {
                const stats = await this.processStatement(
                    msg.CCSTMTRS,
                    connectionId,
                    "credit",
                    targetAccountId,
                );
                if (stats) result.accounts.push(stats);
            }
        }

        // Process Bank Accounts
        if (ofxRoot.BANKMSGSRSV1) {
            const bankMsgs = Array.isArray(ofxRoot.BANKMSGSRSV1.STMTTRNRS)
                ? ofxRoot.BANKMSGSRSV1.STMTTRNRS
                : [ofxRoot.BANKMSGSRSV1.STMTTRNRS];

            for (const msg of bankMsgs) {
                const stats = await this.processStatement(
                    msg.STMTRS,
                    connectionId,
                    "checking",
                    targetAccountId,
                );
                if (stats) result.accounts.push(stats);
            }
        }

        return result;
    }

    async importQif(
        qifData: string,
        targetAccountId?: string,
    ): Promise<ImportResult> {
        const result: ImportResult = { accounts: [] };

        // 1. Ensure Data Provider exists
        const providerName = "QIF Import";
        const providerSlug = "qif-import";
        let providerId;

        const providerRes = await query(
            "SELECT id FROM data_providers WHERE slug = $1",
            [providerSlug],
        );
        if (providerRes.rows.length > 0) {
            providerId = providerRes.rows[0].id;
        } else {
            const newProvider = await query(
                "INSERT INTO data_providers (name, slug) VALUES ($1, $2) RETURNING id",
                [providerName, providerSlug],
            );
            providerId = newProvider.rows[0].id;
        }

        // 2. Ensure Provider Connection exists
        const institutionName = "QIF Manual Import";
        let connectionId;
        const connectionRes = await query(
            "SELECT id FROM provider_connections WHERE provider_id = $1 AND institution_name = $2",
            [providerId, institutionName],
        );

        if (connectionRes.rows.length > 0) {
            connectionId = connectionRes.rows[0].id;
        } else {
            const newConnection = await query(
                `INSERT INTO provider_connections (provider_id, api_key, customer_id, institution_name)
                 VALUES ($1, 'manual', 'manual', $2) RETURNING id`,
                [providerId, institutionName],
            );
            connectionId = newConnection.rows[0].id;
        }

        // 3. Find or Create Account
        let accountId: string;
        if (targetAccountId) {
            accountId = targetAccountId;
        } else {
            const accountRes = await query(
                "SELECT id FROM accounts WHERE provider_account_id = $1",
                ["qif-default"],
            );

            if (accountRes.rows.length > 0) {
                accountId = accountRes.rows[0].id;
            } else {
                const newAccount = await query(
                    `INSERT INTO accounts (connection_id, provider_account_id, name, type, balance)
                     VALUES ($1, $2, $3, $4, 0) RETURNING id`,
                    [
                        connectionId,
                        "qif-default",
                        "Default QIF Account",
                        "checking",
                    ],
                );
                accountId = newAccount.rows[0].id;
            }
        }

        // 4. Parse QIF Data
        const lines = qifData.split(/\r?\n/);
        let currentTxn: any = null;
        const transactions: any[] = [];

        for (const line of lines) {
            if (line.startsWith("!Type:")) continue;
            if (line === "^") {
                if (currentTxn) transactions.push(currentTxn);
                currentTxn = null;
                continue;
            }
            if (!line) continue;

            if (!currentTxn) currentTxn = {};

            const code = line[0];
            const value = line.substring(1);

            switch (code) {
                case "D": // Date
                    currentTxn.date = this.parseQifDate(value);
                    break;
                case "T": // Amount
                    currentTxn.amount = parseFloat(value.replace(/,/g, ""));
                    break;
                case "P": // Payee
                    currentTxn.description = value;
                    break;
                case "M": // Memo
                    currentTxn.memo = value;
                    break;
                case "N": // Check number
                    currentTxn.fitId = value;
                    break;
            }
        }

        // 5. Insert Transactions
        let insertedCount = 0;
        let skippedCount = 0;

        for (const txn of transactions) {
            const description = txn.memo
                ? `${txn.description} - ${txn.memo}`
                : txn.description;
            const fitId =
                txn.fitId ||
                `qif-${accountId}-${txn.date}-${txn.amount}-${txn.description}`;

            try {
                const insertRes = await query(
                    `INSERT INTO transactions
                    (account_id, provider_transaction_id, date, description, amount, status)
                    VALUES ($1, $2, $3, $4, $5, 'cleared')
                    ON CONFLICT (provider_transaction_id) DO NOTHING
                    RETURNING id`,
                    [accountId, fitId, txn.date, description, txn.amount],
                );

                if (insertRes.rowCount && insertRes.rowCount > 0) {
                    insertedCount++;
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error("Failed to insert QIF transaction:", err);
            }
        }

        result.accounts.push({
            accountId: accountId,
            inserted: insertedCount,
            skipped: skippedCount,
        });

        return result;
    }

    private parseQifDate(qifDate: string): string {
        const parts = qifDate.split(/[/'-]/);
        if (parts.length === 3) {
            let month = parts[0].padStart(2, "0");
            let day = parts[1].padStart(2, "0");
            let year = parts[2];
            if (year.length === 2) {
                year = parseInt(year) > 70 ? `19${year}` : `20${year}`;
            }
            return `${year}-${month}-${day}`;
        }
        return qifDate;
    }

    private async processStatement(
        stmtRs: any,
        connectionId: string,
        defaultType: string,
        targetAccountId?: string,
    ) {
        // Identify Account
        let accountIdRaw = "";
        if (stmtRs.CCACCTFROM) {
            accountIdRaw = stmtRs.CCACCTFROM.ACCTID;
        } else if (stmtRs.BANKACCTFROM) {
            accountIdRaw = stmtRs.BANKACCTFROM.ACCTID;
        }

        if (!accountIdRaw) {
            return null;
        }

        // Find or Create Account
        let accountId;
        if (targetAccountId) {
            accountId = targetAccountId;
        } else {
            const accountRes = await query(
                "SELECT id FROM accounts WHERE provider_account_id = $1",
                [accountIdRaw],
            );

            if (accountRes.rows.length > 0) {
                accountId = accountRes.rows[0].id;
            } else {
                const newAccount = await query(
                    `INSERT INTO accounts (connection_id, provider_account_id, name, type, balance)
                 VALUES ($1, $2, $3, $4, 0) RETURNING id`,
                    [
                        connectionId,
                        accountIdRaw,
                        `Imported Account ${accountIdRaw}`,
                        defaultType,
                    ],
                );
                accountId = newAccount.rows[0].id;
            }
        }

        // Process Transactions
        const transactions = stmtRs.BANKTRANLIST?.STMTTRN;
        if (!transactions) {
            return { accountId: accountIdRaw, inserted: 0, skipped: 0 };
        }

        const txnList = Array.isArray(transactions)
            ? transactions
            : [transactions];

        let insertedCount = 0;
        let skippedCount = 0;

        for (const txn of txnList) {
            // Parse date: OFX dates are YYYYMMDDHHMMSS usually
            // e.g., 20251009000000 -> 2025-10-09
            const dateStr = txn.DTPOSTED.substring(0, 8);
            const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;

            const amount = parseFloat(txn.TRNAMT);
            const fitId = txn.FITID;
            const memo = txn.MEMO || txn.NAME || "";

            // Insert Transaction
            try {
                const result = await query(
                    `INSERT INTO transactions
                    (account_id, provider_transaction_id, date, description, amount, status)
                    VALUES ($1, $2, $3, $4, $5, 'cleared')
                    ON CONFLICT (provider_transaction_id) DO NOTHING
                    RETURNING id`,
                    [accountId, fitId, formattedDate, memo, amount],
                );

                if (result.rowCount && result.rowCount > 0) {
                    insertedCount++;
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error(`Failed to insert transaction ${fitId}:`, err);
            }
        }

        return {
            accountId: accountIdRaw,
            inserted: insertedCount,
            skipped: skippedCount,
        };
    }
}

module.exports = {
    ImportService,
};
