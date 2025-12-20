import express = require("express");
import multer = require("multer");
import { ImportService } from "../services/importService";

const router = express.Router();
// Store files in memory as they are text and we process them immediately
const upload = multer({ storage: multer.memoryStorage() });
const importService = new ImportService();

// POST /api/imports
router.post(
    "/",
    upload.single("file"),
    async (req: express.Request, res: express.Response) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }

            const fileContent = req.file.buffer.toString("utf8");
            const accountId = req.body.accountId;
            const result = await importService.importOfx(
                fileContent,
                accountId,
            );

            res.json({
                message: "Import processed successfully",
                data: result,
            });
        } catch (error) {
            console.error("Error processing import:", error);
            res.status(500).json({
                error: "Internal server error processing file",
            });
        }
    },
);

module.exports = router;
