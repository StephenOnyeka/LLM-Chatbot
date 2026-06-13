import { Router } from "express";
import Stripe from "stripe";
import { env } from "../config.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import {
  findUserById,
  findUserByStripeCustomerId,
  setUserProStatus,
} from "../repos/users.js";
import { sendProCancelEmail, sendProUpgradeEmail } from "../lib/mailer.js";

const router = Router();

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, "Payment system is not configured.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" });
}

/**
 * Extract the current billing-period end from a Stripe subscription as an ISO
 * string. In recent API versions current_period_end lives on the subscription
 * item; we fall back to the (legacy) top-level field if present.
 */
function periodEndIso(sub: Stripe.Subscription | null | undefined): string | undefined {
  if (!sub) return undefined;
  const unix =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof unix === "number" ? new Date(unix * 1000).toISOString() : undefined;
}

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe Checkout session for the Pro monthly subscription.
 * Returns { url } to redirect the user to Stripe.
 */
router.post(
  "/create-checkout-session",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.isPro) {
      throw new HttpError(400, "You are already a Pro member.");
    }

    const stripe = getStripe();

    const frontendBase =
      env.CORS_ORIGIN[0] ?? "http://localhost:5173";

    let sessionParams: Stripe.Checkout.SessionCreateParams;

    if (env.STRIPE_PRICE_ID) {
      // Use a pre-configured Price ID (e.g. created in Stripe dashboard)
      sessionParams = {
        mode: "subscription",
        line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${frontendBase}/chat?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendBase}/chat`,
        client_reference_id: user.id,
        customer_email: user.email,
        metadata: { userId: user.id },
      };
    } else {
      // Inline price — $10/month recurring (no Price ID needed)
      sessionParams = {
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: 1000, // $10.00
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
        client_reference_id: user.id,
        customer_email: user.email,
        metadata: { userId: user.id },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  }),
);

/**
 * GET /api/stripe/verify-session?session_id=<id>
 * Called by the frontend after a successful redirect to validate the payment
 * and immediately upgrade the user (before a webhook arrives).
 */
router.get(
  "/verify-session",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = req.query["session_id"] as string | undefined;
    if (!sessionId) throw new HttpError(400, "session_id is required");

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      throw new HttpError(402, "Payment not completed.");
    }

    const userId = req.user!.id;
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;
    const subscription =
      typeof session.subscription === "string"
        ? null
        : (session.subscription as Stripe.Subscription | null);
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : subscription?.id;
    const expiresAt = periodEndIso(subscription);

    // setUserProStatus reads the previous is_pro atomically and returns it, so
    // the welcome email fires only on the first upgrade — even if the success
    // URL is reloaded (the old cached-read approach could send twice).
    const wasPro = await setUserProStatus(
      userId,
      true,
      customerId,
      subscriptionId,
      expiresAt,
    );

    if (wasPro === false) {
      sendProUpgradeEmail(req.user!.email, req.user!.name).catch((err) => {
        console.error("Failed to send Pro welcome email in verify-session:", err);
      });
    }

    res.json({ ok: true, isPro: true });
  }),
);

/**
 * POST /api/stripe/webhook
 * Stripe sends events here. We listen for subscription lifecycle events.
 * Requires STRIPE_WEBHOOK_SECRET to be set for signature verification.
 */
router.post(
  "/webhook",
  // Raw body needed for Stripe signature verification — must come BEFORE json()
  // We handle raw parsing inline using express.raw()
  (req, _res, next) => {
    // Body is already buffered by express.raw() mounted in app.ts
    next();
  },
  asyncHandler(async (req, res) => {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      // Webhook secret not configured — skip silently (dev mode)
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

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        if (userId) {
          const customerId =
            typeof session.customer === "string" ? session.customer : undefined;
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : undefined;

          // The webhook payload only carries the subscription id, so fetch the
          // full subscription to read the current billing-period end.
          let expiresAt: string | undefined;
          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              expiresAt = periodEndIso(sub);
            } catch (err) {
              console.error("Failed to retrieve subscription for expiry:", err);
            }
          }

          // We still need the user's email/name for the welcome email; load it,
          // but use the atomic previous-status return value for the send guard.
          const user = await findUserById(userId);
          const wasPro = await setUserProStatus(
            userId,
            true,
            customerId,
            subscriptionId,
            expiresAt,
          );

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
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = await findUserByStripeCustomerId(customerId);
        if (user) {
          // isPro=false also clears pro_expires_at inside setUserProStatus.
          await setUserProStatus(user.id, false);
        }
        break;
      }

      case "invoice.payment_failed": {
        // Optional: notify user — for now just log
        const invoice = event.data.object as Stripe.Invoice;
        console.warn("Payment failed for customer:", invoice.customer);
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  }),
);

/**
 * POST /api/stripe/cancel-subscription
 * Lets a Pro user cancel and downgrade themselves (used during testing and as
 * the in-app "Cancel Pro" action). Cancels immediately so the change is visible
 * right away even when STRIPE_WEBHOOK_SECRET isn't configured.
 */
router.post(
  "/cancel-subscription",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const user = await findUserById(userId);
    if (!user?.isPro) {
      throw new HttpError(400, "You are not a Pro member.");
    }
    if (!user.stripeSubscriptionId) {
      throw new HttpError(400, "No active subscription found to cancel.");
    }

    const stripe = getStripe();

    // Immediate cancellation. To instead cancel at the end of the paid period,
    // swap this for:
    //   await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    // and skip the setUserProStatus(false) below — the customer.subscription.deleted
    // webhook will downgrade them when the period actually ends.
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (err) {
      const message = (err as Error).message;
      // If the subscription is already gone on Stripe's side, proceed to
      // downgrade locally rather than blocking the user.
      console.error("Stripe subscription cancel failed:", message);
    }

    // Downgrade now (also clears pro_expires_at) instead of waiting on a webhook.
    await setUserProStatus(userId, false);

    sendProCancelEmail(user.email, user.name).catch((err) => {
      console.error("Failed to send Pro cancellation email:", err);
    });

    res.json({ ok: true, isPro: false });
  }),
);

export default router;
