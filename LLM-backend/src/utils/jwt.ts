import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign({ sub: userId }, env.JWT_SECRET, opts);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: decoded.sub };
}
