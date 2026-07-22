import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeRedisStub } from "./redisMock.js";
import { authHeader, testUser, testProUser } from "./helpers.js";

const redisStub = makeRedisStub();
vi.mock("../src/utils/redis.js", () => ({
  getRedis: () => redisStub,
  pingRedis: vi.fn().mockResolvedValue(undefined),
  quitRedis: vi.fn().mockResolvedValue(undefined),
  bullmqConnectionOptions: () => ({}),
}));
vi.mock("../src/config/database.js", () => ({
  pool: { query: vi.fn() },
  query: vi.fn(),
}));
vi.mock("../src/repositories/user.repository.js", () => ({
  findUserById: vi.fn(),
}));

// Mock the stripe service so no Stripe SDK / network is used. The controller
// (auth guard, "already Pro" check, query parsing, webhook secret gate) runs.
vi.mock("../src/services/stripe.service.js", () => ({
  getStripe: vi.fn(),
  createCheckoutSession: vi.fn(),
  verifyCheckoutSession: vi.fn(),
  cancelSubscription: vi.fn(),
  handleWebhookEvent: vi.fn(),
}));

const userRepo = await import("../src/repositories/user.repository.js");
const stripeService = await import("../src/services/stripe.service.js");
const { createApp } = await import("../src/app.js");
const app = createApp();

describe("stripe API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/stripe/create-checkout-session", () => {
    it("requires auth", async () => {
      const res = await request(app).post("/api/stripe/create-checkout-session");
      expect(res.status).toBe(401);
    });

    it("returns a checkout url for a non-Pro user", async () => {
      vi.mocked(userRepo.findUserById).mockResolvedValue(testUser);
      vi.mocked(stripeService.createCheckoutSession).mockResolvedValue(
        "https://checkout.stripe.com/pay/cs_test_123" as never,
      );

      const res = await request(app)
        .post("/api/stripe/create-checkout-session")
        .set("Authorization", authHeader(testUser.id));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ url: "https://checkout.stripe.com/pay/cs_test_123" });
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        testUser.id,
        testUser.email,
      );
    });

    it("returns 400 when the user is already Pro", async () => {
      vi.mocked(userRepo.findUserById).mockResolvedValue(testProUser);

      const res = await request(app)
        .post("/api/stripe/create-checkout-session")
        .set("Authorization", authHeader(testProUser.id));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already a Pro/);
      expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/stripe/verify-session", () => {
    it("returns 400 when session_id is missing", async () => {
      vi.mocked(userRepo.findUserById).mockResolvedValue(testUser);

      const res = await request(app)
        .get("/api/stripe/verify-session")
        .set("Authorization", authHeader(testUser.id));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/session_id is required/);
    });

    it("verifies a paid session and returns the result", async () => {
      vi.mocked(userRepo.findUserById).mockResolvedValue(testUser);
      vi.mocked(stripeService.verifyCheckoutSession).mockResolvedValue({
        isPro: true,
      } as never);

      const res = await request(app)
        .get("/api/stripe/verify-session?session_id=cs_test_123")
        .set("Authorization", authHeader(testUser.id));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isPro: true });
      expect(stripeService.verifyCheckoutSession).toHaveBeenCalledWith(
        "cs_test_123",
        testUser.id,
        testUser.email,
        testUser.name,
      );
    });
  });

  describe("POST /api/stripe/cancel-subscription", () => {
    it("cancels for the authenticated user", async () => {
      vi.mocked(userRepo.findUserById).mockResolvedValue(testProUser);
      vi.mocked(stripeService.cancelSubscription).mockResolvedValue({
        canceled: true,
      } as never);

      const res = await request(app)
        .post("/api/stripe/cancel-subscription")
        .set("Authorization", authHeader(testProUser.id));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ canceled: true });
      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(testProUser.id);
    });

    it("requires auth", async () => {
      const res = await request(app).post("/api/stripe/cancel-subscription");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/stripe/webhook", () => {
    // STRIPE_WEBHOOK_SECRET is set in setup.env.ts, so the controller attempts
    // real signature verification via getStripe(). We mock getStripe() to return
    // a stub whose constructEvent throws (as it would for an unsigned request),
    // proving the signature gate returns 400 rather than processing the event.
    it("rejects a request with an invalid/missing signature (400)", async () => {
      vi.mocked(stripeService.getStripe).mockReturnValue({
        webhooks: {
          constructEvent: vi.fn(() => {
            throw new Error("No signatures found matching the expected signature");
          }),
        },
      } as never);

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(Buffer.from(JSON.stringify({ type: "checkout.session.completed" })));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Webhook signature invalid/);
      expect(stripeService.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it("processes a validly-signed event and returns { received: true }", async () => {
      const fakeEvent = { type: "checkout.session.completed", id: "evt_1" };
      vi.mocked(stripeService.getStripe).mockReturnValue({
        webhooks: { constructEvent: vi.fn(() => fakeEvent) },
      } as never);
      vi.mocked(stripeService.handleWebhookEvent).mockResolvedValue(undefined as never);

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1,v1=fake")
        .send(Buffer.from(JSON.stringify(fakeEvent)));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      expect(stripeService.handleWebhookEvent).toHaveBeenCalledWith(fakeEvent);
    });
  });
});
