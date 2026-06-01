import type { NextFunction, Request, Response } from "express";
import { COOKIE_NAME } from "../lib/cookies.js";
import { verifyToken } from "../lib/jwt.js";
import { findUserById } from "../repos/users.js";
import { HttpError } from "./error.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Prefer the Authorization: Bearer header (works cross-site on every
    // browser, since it doesn't depend on third-party cookies). Fall back to
    // the cookie for same-site requests and local development.
    const header = req.headers.authorization;
    const bearer =
      header && header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    const token = bearer || req.cookies?.[COOKIE_NAME];
    if (!token) throw new HttpError(401, "Not authenticated");
    const { sub } = verifyToken(token);
    const user = await findUserById(sub);
    if (!user) throw new HttpError(401, "Not authenticated");
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof HttpError) next(err);
    else next(new HttpError(401, "Not authenticated"));
  }
}
