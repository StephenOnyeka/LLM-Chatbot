import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { Router } from "express";
import multer from "multer";
import { env } from "../config.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Attachment } from "../types.js";

const router = Router();
router.use(requireAuth);

// Ensure upload directory exists
const UPLOAD_DIR = resolve(process.cwd(), env.UPLOAD_DIR);
mkdirSync(UPLOAD_DIR, { recursive: true });

// 10 MB per file; only allow images + common docs
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed.`));
    }
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
      throw new HttpError(403, "File uploads require a Pro plan. Upgrade to continue.");
    }

    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new HttpError(413, "File is too large. Maximum size is 10 MB."));
        }
        return next(new HttpError(400, err.message));
      }
      if (err) {
        return next(new HttpError(400, (err as Error).message));
      }

      const file = req.file;
      if (!file) return next(new HttpError(400, "No file uploaded."));

      const attachment: Attachment = {
        url: `${env.PUBLIC_URL}/api/uploads/${file.filename}`,
        name: file.originalname,
        mimeType: file.mimetype,
        localPath: file.path,
      };

      res.status(201).json(attachment);
    });
  }),
);

export default router;
