import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database.js";
import { env } from "../config/env.js";
import { HttpError } from "../middlewares/error.middleware.js";
import { uploadMiddleware } from "../middlewares/upload.middleware.js";

export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isPro) {
    throw new HttpError(
      403, "File uploads require a Pro plan. Upgrade to continue.",
    );
  }

  await new Promise<void>((resolveMw, rejectMw) => {
    uploadMiddleware.single("file")(req, res, (err) => {
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
}
