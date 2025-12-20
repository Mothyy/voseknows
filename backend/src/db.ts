import { Pool, QueryResult } from "pg";

const dotenv = require("dotenv");

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * A shared query function that uses the connection pool.
 * @param {string} text The SQL query string.
 * @param {any[]} [params] An array of parameters to be safely passed to the query.
 * @returns {Promise<QueryResult>} A promise that resolves with the query result.
 */
const query = (text: string, params: any[]): Promise<QueryResult> => {
    return pool.query(text, params);
};

module.exports = {
    query,
    pool,
};
