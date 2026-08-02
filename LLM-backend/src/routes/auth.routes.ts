import { Router } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  register,
  login,
  google,
  forgotPassword,
  resetPassword,
  logout,
  me,
} from "../controllers/auth.controller.js";

const router = Router();

const authLimiter = rateLimit({
  bucket: "auth",
  limit: env.RATE_LIMIT_AUTH_PER_MINUTE,
});

router.post("/register", authLimiter, asyncHandler(register));
router.post("/login", authLimiter, asyncHandler(login));
router.post("/google", authLimiter, asyncHandler(google));
router.post("/forgot-password", authLimiter, asyncHandler(forgotPassword));
router.post("/reset-password", authLimiter, asyncHandler(resetPassword));
router.post("/logout", logout);
router.get("/me", requireAuth, asyncHandler(me));

export default router;
