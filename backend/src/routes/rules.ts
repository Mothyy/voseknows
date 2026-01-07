import express = require("express");
import { RuleService } from "../services/ruleService";

const router = express.Router();
const auth = require("../middleware/auth");

// Protect all routes
router.use(auth);

const ruleService = new RuleService();

// GET /api/rules
router.get("/", async (req: any, res) => {
    try {
        const rules = await ruleService.getRules(req.user.id);
        res.json(rules);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch rules" });
    }
});

// POST /api/rules
router.post("/", async (req: any, res) => {
    try {
        const rule = await ruleService.createRule(req.user.id, req.body);
        res.status(201).json(rule);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: "Failed to create rule" });
    }
});

// PUT /api/rules/:id
router.put("/:id", async (req: any, res) => {
    try {
        const rule = await ruleService.updateRule(req.user.id, req.params.id, req.body);
        if (!rule) return res.status(404).json({ error: "Rule not found" });
        res.json(rule);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: "Failed to update rule" });
    }
});

// DELETE /api/rules/:id
router.delete("/:id", async (req: any, res) => {
    try {
        await ruleService.deleteRule(req.user.id, req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete rule" });
    }
});

module.exports = router;
