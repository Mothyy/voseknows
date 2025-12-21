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
