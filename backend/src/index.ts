// Use `import = require()` for CommonJS compatibility with types
import express = require("express");
import dotenv = require("dotenv");
import cors = require("cors");
import cookieParser = require("cookie-parser");

// Import types for Express
import type { Request, Response } from "express";

// Import the query function and routers
const { query } = require("./db");
const transactionRoutes = require("./routes/transactions");
const accountRoutes = require("./routes/accounts");
const categoryRoutes = require("./routes/categories");
const dataProviderRoutes = require("./routes/dataProviders");
const importRoutes = require("./routes/imports");
const budgetRoutes = require("./routes/budgets");
const reportRoutes = require("./routes/reports");
const authRoutes = require("./routes/auth");
const settingsRoutes = require("./routes/settings");

// Configure dotenv to read .env file
dotenv.config();

const app = express();
const port = 3001;

// Middleware setup
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/transactions", transactionRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/data-providers", dataProviderRoutes);
app.use("/api/imports", importRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);

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
app.listen(port, "0.0.0.0", () => {
    console.log(`Backend server is running at http://0.0.0.0:${port}`);
    console.log(`Startup Time: ${new Date().toISOString()}`);
    console.log("Available routes:");
    console.log("  - GET /api/transactions");
    console.log("  - GET /api/accounts");
    console.log("  - GET /api/categories");
    console.log("  - POST /api/data-providers/connections");
    console.log("  - POST /api/data-providers/connections/:id/sync");
    console.log("  - POST /api/imports");
    console.log("  - GET /api/budgets");
    console.log("  - GET /api/reports/summary");
    console.log("  - GET /api/dashboard");
});
