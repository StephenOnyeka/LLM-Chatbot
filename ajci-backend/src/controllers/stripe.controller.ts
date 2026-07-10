import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../middlewares/error.middleware.js";
import {
  getStripe,
  createCheckoutSession,
  verifyCheckoutSession,
  cancelSubscription,
  handleWebhookEvent,
} from "../services/stripe.service.js";
import Stripe from "stripe";

export async function createSession(req: Request, res: Response) {
  if (req.user!.isPro) {
    throw new HttpError(400, "You are already a Pro member.");
  }
  const url = await createCheckoutSession(req.user!.id, req.user!.email);
  res.json({ url });
}

export async function verifySession(req: Request, res: Response) {
  const sessionId = req.query["session_id"] as string | undefined;
  if (!sessionId) throw new HttpError(400, "session_id is required");

  const result = await verifyCheckoutSession(sessionId, req.user!.id, req.user!.email, req.user!.name);
  res.json(result);
}

export async function cancel(req: Request, res: Response) {
  const result = await cancelSubscription(req.user!.id);
  res.json(result);
}

export async function webhook(req: Request, res: Response) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    res.json({ received: true });
    return;
  }

  const stripe = getStripe();
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    throw new HttpError(400, `Webhook signature invalid: ${(err as Error).message}`);
  }

  await handleWebhookEvent(event);

  res.json({ received: true });
}

export function webhookRawMiddleware(req: Request, res: Response, next: NextFunction) {
  next();
}
