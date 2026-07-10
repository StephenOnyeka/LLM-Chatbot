import { Request, Response } from "express";
import { CreateSessionBody } from "../validators/sessions.validator.js";
import {
  getUserSessions,
  createSession,
  deleteSession,
  getSessionMessages,
} from "../services/sessions.service.js";

export async function listSessions(req: Request, res: Response) {
  const sessions = await getUserSessions(req.user!.id);
  res.json(sessions);
}

export async function createNewSession(req: Request, res: Response) {
  const body = CreateSessionBody.parse(req.body ?? {});
  const session = await createSession(req.user!.id, body);
  res.status(201).json(session);
}

export async function removeSession(req: Request, res: Response) {
  await deleteSession(req.params.id!, req.user!.id);
  res.status(204).end();
}

export async function listSessionMessages(req: Request, res: Response) {
  const messages = await getSessionMessages(req.params.id!, req.user!.id);
  res.json(messages);
}
