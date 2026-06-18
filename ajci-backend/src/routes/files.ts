import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { HttpError } from '../middleware/error.js';
import { pool } from '../db.js';
import { env } from '../config.js';

const router = Router();

router.get(
  '/:id',
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // A file id is immutable — its bytes never change — so the id itself is a
    // sound ETag. Short-circuit before touching the DB when the client already
    // has it, avoiding a full BYTEA read on every re-render.
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
  })
);

export default router;
