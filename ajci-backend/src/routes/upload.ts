import { Router } from "express";
import multer from "multer";
import { pool } from "../db.js";
import { env } from "../config.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const router = Router();
router.use(requireAuth);

// Allowed MIME types for uploads. Restricted to what Gemini can read inline
// (images, PDF, plain text) so we never accept a file the model can't process.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

// Keep files in memory; bytes are persisted to the DB, not disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!file) return cb(new Error("No file uploaded"));
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(
      new Error(
        `File type "${file.mimetype}" is not allowed. Allowed types: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}`,
      ),
    );
  },
});

/**
 * POST /api/upload
 * Multipart form-data with field "file".
 * Pro users only. Returns the attachment metadata.
 */
router.post(
  "/",
  asyncHandler(async (req, res, next) => {
    // Check Pro status before accepting the file bytes
    if (!req.user?.isPro) {
      throw new HttpError(
        403,
        "File uploads require a Pro plan. Upgrade to continue.",
      );
    }

    // Run multer as promise-style middleware so we can await the DB insert.
    // Multer/fileFilter errors are client errors → surface as 400.
    await new Promise<void>((resolveMw, rejectMw) => {
      upload.single("file")(req, res, (err) => {
        if (err) return rejectMw(new HttpError(400, (err as Error).message));
        resolveMw();
      });
    });

    const file = req.file;
    if (!file) return next(new HttpError(400, "No file uploaded."));

    const { buffer, originalname, mimetype } = file;
    const userId = req.user.id;

    const result = await pool.query(
      `INSERT INTO files (user_id, filename, mime_type, data)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, originalname, mimetype, buffer],
    );

    const id = result.rows[0].id;
    res.status(201).json({
      id,
      url: `${env.PUBLIC_URL}/api/files/${id}`,
      name: originalname,
      mimeType: mimetype,
      createdAt: new Date().toISOString(),
    });
  }),
);

export default router;
