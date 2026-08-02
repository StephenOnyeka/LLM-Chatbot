import type { Response } from "express";
import { env, isProd } from "../config/env.js";

export const COOKIE_NAME = "ajci_token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// SameSite=None requires Secure=true, so cross-site forces secure cookies.
const sameSite = env.COOKIE_CROSS_SITE ? "none" : "lax";
const secure = env.COOKIE_CROSS_SITE || isProd;

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    domain: env.COOKIE_DOMAIN,
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    domain: env.COOKIE_DOMAIN,
  });
}
