const { query } = require('./src/db');
require('dotenv').config();

async function migrate() {
    try {
        console.log('Starting migration...');
        await query("ALTER TABLE automated_connections ADD COLUMN IF NOT EXISTS date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD';");
        console.log('Migration successful: added date_format to automated_connections');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
