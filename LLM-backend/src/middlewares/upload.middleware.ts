import multer from "multer";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export const uploadMiddleware = multer({
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
