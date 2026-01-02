import jwt = require("jsonwebtoken");
const { query } = require("../db");
import type { Request, Response, NextFunction } from "express";
import crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "voseknows_default_secret_change_me_in_prod";

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email?: string;
    };
    isApiKey?: boolean;
}

const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Check for API Key first (for external scripts)
    const apiKey = req.header("X-API-Key");
    if (apiKey) {
        try {
            // Hash the provided key to compare with the stored hash
            const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

            const result = await query(
                "SELECT user_id FROM api_keys WHERE key_hash = $1",
                [keyHash]
            );

            if (result.rows.length > 0) {
                req.user = { id: result.rows[0].user_id };
                req.isApiKey = true;

                // Update last used time asynchronously
                query("UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1", [keyHash]).catch(console.error);

                return next();
            }
        } catch (err) {
            console.error("API Key Auth Error:", err);
        }
    }

    // 2. Check for JWT in httpOnly cookie (for browser sessions)
    const token = (req as any).cookies?.auth_token;

    if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        req.user = { id: decoded.id };
        next();
    } catch (err) {
        res.status(401).json({ message: "Token is not valid" });
    }
};

module.exports = auth;
