import { Router } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import { chat } from "../controllers/chat.controller.js";

const router = Router();
router.use(requireAuth);

router.post(
  "/:id/chat",
  rateLimit({ bucket: "chat", limit: env.RATE_LIMIT_CHAT_PER_MINUTE }),
  asyncHandler(chat)
);

export default router;
