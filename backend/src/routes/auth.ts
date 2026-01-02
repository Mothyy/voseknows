import express = require("express");
import bcrypt = require("bcryptjs");
import jwt = require("jsonwebtoken");
const { query } = require("../db");
import type { Request, Response } from "express";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "voseknows_default_secret_change_me_in_prod";

// Helper for setting the cookie
const setAuthCookie = (res: Response, token: string, expiresMinutes: number = 60) => {
    res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: expiresMinutes * 60 * 1000,
    });
};

// @route   POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        // Check if user already exists
        const userExists = await query("SELECT id FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user
        const newUser = await query(
            "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, session_timeout_minutes",
            [email, hashedPassword]
        );

        const user = newUser.rows[0];

        // Create token
        const token = jwt.sign({ id: user.id }, JWT_SECRET, {
            expiresIn: `${user.session_timeout_minutes}m`,
        });

        setAuthCookie(res, token, user.session_timeout_minutes);

        res.status(201).json({
            id: user.id,
            email: user.email,
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: "Server error during registration" });
    }
});

// @route   POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const result = await query(
            "SELECT id, email, password_hash, session_timeout_minutes FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, {
            expiresIn: `${user.session_timeout_minutes || 60}m`,
        });

        setAuthCookie(res, token, user.session_timeout_minutes || 60);

        res.json({
            id: user.id,
            email: user.email,
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Server error during login" });
    }
});

// @route   POST /api/auth/logout
router.post("/logout", (req: Request, res: Response) => {
    res.clearCookie("auth_token");
    res.json({ message: "Logged out successfully" });
});

// @route   GET /api/auth/me
router.get("/me", async (req: Request, res: Response) => {
    const token = (req as any).cookies?.auth_token;

    if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        const result = await query(
            "SELECT id, email, session_timeout_minutes FROM users WHERE id = $1",
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(401).json({ message: "Token is not valid" });
    }
});

module.exports = router;
