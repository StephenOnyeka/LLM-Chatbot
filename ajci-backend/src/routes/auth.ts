import { Router } from "express";
import { z } from "zod";
import { clearAuthCookie, setAuthCookie } from "../lib/cookies.js";
import { signToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { createUser, findUserByEmail } from "../repos/users.js";

const router = Router();

const RegisterBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(80),
});

const LoginBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = RegisterBody.parse(req.body);
    const existing = await findUserByEmail(body.email);
    if (existing) throw new HttpError(409, "Email already registered");

    const passwordHash = await hashPassword(body.password);
    const user = await createUser(body.email, body.name, passwordHash);

    setAuthCookie(res, signToken(user.id));
    res.status(201).json(user);
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = LoginBody.parse(req.body);
    const found = await findUserByEmail(body.email);
    if (!found) throw new HttpError(401, "Invalid email or password");

    const ok = await verifyPassword(body.password, found.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid email or password");

    const user = { id: found.id, email: found.email, name: found.name };
    setAuthCookie(res, signToken(user.id));
    res.json(user);
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
