import type { Request, Response } from "express";
const express = require("express");
const router = express.Router();
const { query } = require("../db");

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get("/", async (req: Request, res: Response) => {
    try {
        const sql = `
            SELECT id, name, parent_id
            FROM categories
            ORDER BY sort_order, name ASC;
        `;
        const { rows: categories } = await query(sql, []);

        // Helper function to build the tree structure
        const buildTree = (list: any[]): any[] => {
            const map: { [key: string]: any } = {};
            const roots: any[] = [];

            // First pass: create a map of all nodes
            list.forEach((node) => {
                map[node.id] = { ...node, children: [] };
            });

            // Second pass: build the tree
            list.forEach((node) => {
                if (node.parent_id && map[node.parent_id]) {
                    // It's a child, push it to its parent's children array
                    map[node.parent_id].children.push(map[node.id]);
                } else {
                    // It's a root node
                    roots.push(map[node.id]);
                }
            });
            return roots;
        };

        const categoryTree = buildTree(categories);
        res.json(categoryTree);
    } catch (err: any) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Public
 */
router.post("/", async (req: Request, res: Response) => {
    const { name, parent_id } = req.body; // parent_id is optional

    if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
    }

    try {
        const sql = `
            INSERT INTO categories (name, parent_id)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const { rows } = await query(sql, [name, parent_id || null]);
        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error("Error creating category:", err);
        if (err.code === "23505") {
            return res
                .status(409)
                .json({ error: `Category '${name}' already exists.` });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   PATCH /api/categories/:id
 * @desc    Update a category
 * @access  Public
 */
router.patch("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, parent_id, sort_order } = req.body;

    if (
        name === undefined &&
        parent_id === undefined &&
        sort_order === undefined
    ) {
        return res.status(400).json({
            error: "At least one field to update must be provided: name, parent_id, sort_order.",
        });
    }

    try {
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name !== undefined) {
            setClauses.push(`name = $${paramIndex++}`);
            values.push(name);
        }

        if (parent_id !== undefined) {
            setClauses.push(`parent_id = $${paramIndex++}`);
            values.push(parent_id); // Allow setting parent_id to null
        }

        if (sort_order !== undefined) {
            setClauses.push(`sort_order = $${paramIndex++}`);
            values.push(sort_order);
        }

        values.push(id); // For the WHERE clause

        const sql = `
            UPDATE categories
            SET ${setClauses.join(", ")}
            WHERE id = $${paramIndex}
            RETURNING *;
        `;

        const { rows } = await query(sql, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.json(rows[0]);
    } catch (err: any) {
        console.error(`Error updating category ${id}:`, err);
        if (err.code === "23505") {
            return res.status(409).json({
                error: `A category with that name already exists under the same parent.`,
            });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete a category
 * @access  Public
 */
router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query(
            "DELETE FROM categories WHERE id = $1",
            [id],
        );
        if (rowCount === 0) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.status(204).send();
    } catch (err: any) {
        console.error(`Error deleting category ${id}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
