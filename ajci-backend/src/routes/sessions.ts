import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import {
  createForUser,
  deleteOwned,
  getOwned,
  listForUser,
} from "../repos/conversations.js";
import { listForConversation } from "../repos/messages.js";

const router = Router();
router.use(requireAuth);

const CreateBody = z.object({ title: z.string().trim().min(1).max(120).optional() });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sessions = await listForUser(req.user!.id);
    res.json(sessions);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = CreateBody.parse(req.body ?? {});
    const session = await createForUser(req.user!.id, body.title ?? "New chat");
    res.status(201).json(session);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const ok = await deleteOwned(req.params.id!, req.user!.id);
    if (!ok) throw new HttpError(404, "Session not found");
    res.status(204).end();
  }),
);

router.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const session = await getOwned(req.params.id!, req.user!.id);
    if (!session) throw new HttpError(404, "Session not found");
    const messages = await listForConversation(session.id);
    res.json(messages);
  }),
);

export default router;
