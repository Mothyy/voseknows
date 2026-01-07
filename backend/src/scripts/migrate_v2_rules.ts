import { query, pool } from "../db";

const migrate = async () => {
    try {
        console.log("Starting migration to multi-condition rules...");

        // 1. Add conditions column
        await query(`ALTER TABLE transaction_rules ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]'`);
        console.log("Added conditions column.");

        // 2. Fetch rules that need migration
        // We check if "conditions" is empty/default but match_value exists
        const res = await query(`
            SELECT id, match_type, match_value 
            FROM transaction_rules 
            WHERE (conditions IS NULL OR jsonb_array_length(conditions) = 0)
            AND match_value IS NOT NULL
        `);

        console.log(`Found ${res.rows.length} rules to migrate.`);

        for (const rule of res.rows) {
            const condition = {
                match_type: rule.match_type || 'contains',
                match_value: rule.match_value
            };

            await query(`UPDATE transaction_rules SET conditions = $1 WHERE id = $2`, [
                JSON.stringify([condition]),
                rule.id
            ]);
        }

        // 3. Make old columns nullable (if they contain constraints) 
        // We won't drop them yet to be safe, but we stop relying on them.
        await query(`ALTER TABLE transaction_rules ALTER COLUMN match_type DROP NOT NULL`);
        await query(`ALTER TABLE transaction_rules ALTER COLUMN match_value DROP NOT NULL`);

        console.log("Migration complete.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        pool.end();
    }
};

migrate();
