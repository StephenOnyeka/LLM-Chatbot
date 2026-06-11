import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { clearAuthCookie, setAuthCookie } from "../lib/cookies.js";
import { signToken } from "../lib/jwt.js";
import { sendPasswordResetEmail } from "../lib/mailer.js";
import { generateOtp, storeOtp, verifyOtp } from "../lib/otp.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  createUser,
  findUserByEmail,
  updateUserPassword,
} from "../repos/users.js";

const router = Router();

// Shared "auth" bucket so an attacker can't double their budget by alternating
// login and register endpoints.
const authLimiter = rateLimit({
  bucket: "auth",
  limit: env.RATE_LIMIT_AUTH_PER_MINUTE,
});

const RegisterBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(80),
});

const LoginBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

const ForgotPasswordBody = z.object({
  email: z.string().email().max(254),
});

const ResetPasswordBody = z.object({
  email: z.string().email().max(254),
  code: z.string().length(6),
  password: z.string().min(6).max(128),
});

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = RegisterBody.parse(req.body);
    const existing = await findUserByEmail(body.email);
    if (existing) throw new HttpError(409, "Email already registered");

    const passwordHash = await hashPassword(body.password);
    const user = await createUser(body.email, body.name, passwordHash);

    const token = signToken(user.id);
    setAuthCookie(res, token);
    // Also return the token so cross-site clients (where third-party cookies
    // are blocked) can send it as an Authorization: Bearer header.
    res.status(201).json({ ...user, token });
  }),
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = LoginBody.parse(req.body);
    const found = await findUserByEmail(body.email);
    if (!found) throw new HttpError(401, "Invalid email or password");

    const ok = await verifyPassword(body.password, found.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid email or password");

    const user = { id: found.id, email: found.email, name: found.name };
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json({ ...user, token });
  }),
);

router.post(
  "/forgot-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = ForgotPasswordBody.parse(req.body);
    const user = await findUserByEmail(body.email);

    // Only send when the account exists, but always respond 200 so the response
    // doesn't reveal whether an email is registered (no account enumeration).
    if (user) {
      const code = generateOtp();
      await storeOtp(body.email, code);
      try {
        await sendPasswordResetEmail(body.email, code);
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        throw new HttpError(502, "Failed to send the reset email. Try again.");
      }
    }

    res.json({ ok: true });
  }),
);

router.post(
  "/reset-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = ResetPasswordBody.parse(req.body);

    const result = await verifyOtp(body.email, body.code);
    if (result === "expired") {
      throw new HttpError(400, "Code expired or not found. Request a new one.");
    }
    if (result === "locked") {
      throw new HttpError(429, "Too many attempts. Request a new code.");
    }
    if (result === "invalid") {
      throw new HttpError(400, "Invalid code.");
    }

    const found = await findUserByEmail(body.email);
    if (!found) throw new HttpError(400, "Code expired or not found. Request a new one.");

    const passwordHash = await hashPassword(body.password);
    await updateUserPassword(found.id, passwordHash);

    const user = { id: found.id, email: found.email, name: found.name };
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json({ ...user, token });
  }),
);

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  }),
);

export default router;
