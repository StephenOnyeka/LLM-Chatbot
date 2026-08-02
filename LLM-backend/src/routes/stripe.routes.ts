import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createSession,
  verifySession,
  cancel,
  webhook,
  webhookRawMiddleware,
} from "../controllers/stripe.controller.js";

const router = Router();

router.post("/create-checkout-session", requireAuth, asyncHandler(createSession));
router.get("/verify-session", requireAuth, asyncHandler(verifySession));
router.post("/cancel-subscription", requireAuth, asyncHandler(cancel));
router.post("/webhook", webhookRawMiddleware, asyncHandler(webhook));

export default router;
