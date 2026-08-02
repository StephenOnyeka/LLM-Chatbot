import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  listSessions,
  createNewSession,
  removeSession,
  listSessionMessages,
} from "../controllers/sessions.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(listSessions));
router.post("/", asyncHandler(createNewSession));
router.delete("/:id", asyncHandler(removeSession));
router.get("/:id/messages", asyncHandler(listSessionMessages));

export default router;
