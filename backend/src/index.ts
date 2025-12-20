// Use `import = require()` for CommonJS compatibility with types
import express = require("express");
import dotenv = require("dotenv");
import cors = require("cors");

// Import types for Express
import type { Request, Response } from "express";

// Import the query function and routers
const { query } = require("./db");
const transactionRoutes = require("./routes/transactions");
const accountRoutes = require("./routes/accounts");
const categoryRoutes = require("./routes/categories");
const dataProviderRoutes = require("./routes/dataProviders");

// Configure dotenv to read .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/transactions", transactionRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/data-providers", dataProviderRoutes);

// A simple root route to confirm the server is running
app.get("/", (req: Request, res: Response) => {
    res.send("Hello from the VoseKnows backend!");
});

// A simple database connection test route
app.get("/db-test", async (req: Request, res: Response) => {
    try {
        const result = await query("SELECT NOW()", []);
        res.json({
            message: "Database connection successful",
            time: result.rows[0].now,
        });
    } catch (err) {
        console.error("Error connecting to the database", err);
        res.status(500).send("Error connecting to the database");
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server is running at http://localhost:${port}`);
    console.log("Available routes:");
    console.log("  - GET /api/transactions");
    console.log("  - GET /api/accounts");
    console.log("  - GET /api/categories");
    console.log("  - POST /api/data-providers/connections");
    console.log("  - POST /api/data-providers/connections/:id/sync");
});
