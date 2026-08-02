import Stripe from "stripe";
import { env } from "../config/env.js";
import { HttpError } from "../middlewares/error.middleware.js";
import {
  findUserById,
  findUserByStripeCustomerId,
  setUserProStatus,
} from "../repositories/user.repository.js";
import { sendProCancelEmail, sendProUpgradeEmail } from "../utils/mailer.js";

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, "Payment system is not configured.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" });
}

export function periodEndIso(sub: Stripe.Subscription | null | undefined): string | undefined {
  if (!sub) return undefined;
  const unix =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof unix === "number" ? new Date(unix * 1000).toISOString() : undefined;
}

export async function createCheckoutSession(userId: string, userEmail: string) {
  const stripe = getStripe();
  const frontendBase = env.CORS_ORIGIN[0] ?? "http://localhost:5173";

  let sessionParams: Stripe.Checkout.SessionCreateParams;

  if (env.STRIPE_PRICE_ID) {
    sessionParams = {
      mode: "subscription",
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${frontendBase}/chat?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/chat`,
      client_reference_id: userId,
      customer_email: userEmail,
      metadata: { userId },
    };
  } else {
    sessionParams = {
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 1000,
            recurring: { interval: "month" },
            product_data: {
              name: "AJCI Pro Plan",
              description: "Unlimited file & image uploads, priority AI access",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendBase}/chat?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/chat`,
      client_reference_id: userId,
      customer_email: userEmail,
      metadata: { userId },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session.url;
}

export async function verifyCheckoutSession(sessionId: string, userId: string, userEmail: string, userName: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (session.payment_status !== "paid" && session.status !== "complete") {
    throw new HttpError(402, "Payment not completed.");
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscription = typeof session.subscription === "string" ? null : (session.subscription as Stripe.Subscription | null);
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : subscription?.id;
  const expiresAt = periodEndIso(subscription);

  const wasPro = await setUserProStatus(userId, true, customerId, subscriptionId, expiresAt);

  if (wasPro === false) {
    sendProUpgradeEmail(userEmail, userName).catch((err) => {
      console.error("Failed to send Pro welcome email in verify-session:", err);
    });
  }

  return { ok: true, isPro: true };
}

export async function cancelSubscription(userId: string) {
  const user = await findUserById(userId);
  if (!user?.isPro) {
    throw new HttpError(400, "You are not a Pro member.");
  }
  if (!user.stripeSubscriptionId) {
    throw new HttpError(400, "No active subscription found to cancel.");
  }

  const stripe = getStripe();

  try {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
  } catch (err) {
    const message = (err as Error).message;
    console.error("Stripe subscription cancel failed:", message);
  }

  await setUserProStatus(userId, false);

  sendProCancelEmail(user.email, user.name).catch((err) => {
    console.error("Failed to send Pro cancellation email:", err);
  });

  return { ok: true, isPro: false };
}

export async function handleWebhookEvent(event: Stripe.Event) {
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      if (userId) {
        const customerId = typeof session.customer === "string" ? session.customer : undefined;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;

        let expiresAt: string | undefined;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            expiresAt = periodEndIso(sub);
          } catch (err) {
            console.error("Failed to retrieve subscription for expiry:", err);
          }
        }

        const user = await findUserById(userId);
        const wasPro = await setUserProStatus(userId, true, customerId, subscriptionId, expiresAt);

        if (wasPro === false && user) {
          sendProUpgradeEmail(user.email, user.name).catch((err) => {
            console.error("Failed to send Pro welcome email in webhook:", err);
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const user = await findUserByStripeCustomerId(customerId);
      if (user) {
        await setUserProStatus(user.id, false);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn("Payment failed for customer:", invoice.customer);
      break;
    }
  }
}
