import express = require("express");
import multer = require("multer");
const auth = require("../middleware/auth");
const { ImportService } = require("../services/importService");

const router = express.Router();
// Store files in memory as they are text and we process them immediately
const upload = multer({ storage: multer.memoryStorage() });
const importService = new ImportService();

router.use(auth);

// POST /api/imports
router.post(
    "/",
    upload.single("file"),
    async (req: any, res: express.Response) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }

            const fileContent = req.file.buffer.toString("utf8");
            const accountId = req.body.accountId;
            const format = req.body.format || "ofx";
            const dateFormat = req.body.dateFormat;
            const userId = req.user.id;

            let result;
            if (format.toLowerCase() === "qif") {
                result = await importService.importQif(
                    fileContent,
                    userId,
                    accountId,
                    dateFormat,
                );
            } else {
                result = await importService.importOfx(fileContent, userId, accountId);
            }

            res.json({
                message: "Import processed successfully",
                data: result,
            });
        } catch (error: any) {
            console.error("Error processing import:", error);
            res.status(500).json({
                error: error.message || "Internal server error processing file",
            });
        }
    },
);

module.exports = router;
