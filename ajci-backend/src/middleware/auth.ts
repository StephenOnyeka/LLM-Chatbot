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
    const token = req.cookies?.[COOKIE_NAME];
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
