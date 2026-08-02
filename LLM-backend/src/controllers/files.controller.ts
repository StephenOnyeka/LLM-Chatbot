import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database.js";
import { HttpError } from "../middlewares/error.middleware.js";

export async function getFile(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;

  const etag = `"${id}"`;
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const result = await pool.query(
    `SELECT filename, mime_type, data FROM files WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) {
    return next(new HttpError(404, 'File not found'));
  }
  const { filename, mime_type, data } = result.rows[0];
  res.setHeader('Content-Type', mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(data);
}
