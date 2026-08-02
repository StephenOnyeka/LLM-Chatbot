import {
  createForUser,
  deleteOwned,
  listForUser,
  getOwned,
} from "../repositories/conversation.repository.js";
import { listForConversation } from "../repositories/message.repository.js";
import { HttpError } from "../middlewares/error.middleware.js";
import { z } from "zod";
import { CreateSessionBody } from "../validators/sessions.validator.js";

export async function getUserSessions(userId: string) {
  return await listForUser(userId);
}

export async function createSession(userId: string, body: z.infer<typeof CreateSessionBody>) {
  return await createForUser(userId, body.title ?? "New chat");
}

export async function deleteSession(sessionId: string, userId: string) {
  const ok = await deleteOwned(sessionId, userId);
  if (!ok) throw new HttpError(404, "Session not found");
}

export async function getSessionMessages(sessionId: string, userId: string) {
  const session = await getOwned(sessionId, userId);
  if (!session) throw new HttpError(404, "Session not found");
  return await listForConversation(session.id);
}
