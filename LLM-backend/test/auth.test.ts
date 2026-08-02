import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeRedisStub } from "./redisMock.js";
import { authHeader, testUser } from "./helpers.js";

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

// Mock the auth service so no DB / bcrypt / email / Google calls happen. The
// real controller (validation + JWT signing + cookie setting) still runs.
vi.mock("../src/services/auth.service.js", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  googleSignIn: vi.fn(),
  processForgotPassword: vi.fn(),
  processResetPassword: vi.fn(),
}));

// requireAuth (used by GET /me) calls findUserById — return our test user.
vi.mock("../src/repositories/user.repository.js", () => ({
  findUserById: vi.fn(),
}));

const authService = await import("../src/services/auth.service.js");
const userRepo = await import("../src/repositories/user.repository.js");
const { createApp } = await import("../src/app.js");
const app = createApp();

const publicUser = { id: testUser.id, email: testUser.email, name: testUser.name };

describe("auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("creates a user, sets a cookie, returns 201 + token", async () => {
      vi.mocked(authService.registerUser).mockResolvedValue(publicUser as never);

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "secret1", name: "Test User" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject(publicUser);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.headers["set-cookie"]?.[0]).toMatch(/ajci_token=/);
      expect(authService.registerUser).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "secret1",
        name: "Test User",
      });
    });

    it("rejects an invalid email with 400", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "not-an-email", password: "secret1", name: "Test User" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid request body");
      expect(authService.registerUser).not.toHaveBeenCalled();
    });

    it("rejects a too-short password with 400", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "123", name: "Test User" });

      expect(res.status).toBe(400);
    });

    it("surfaces a duplicate-email conflict as 409", async () => {
      const { HttpError } = await import("../src/middlewares/error.middleware.js");
      vi.mocked(authService.registerUser).mockRejectedValue(
        new HttpError(409, "Email already registered"),
      );

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "secret1", name: "Test User" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: "Email already registered" });
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in and returns a token", async () => {
      vi.mocked(authService.loginUser).mockResolvedValue(publicUser as never);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "secret1" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(publicUser);
      expect(res.body.token).toEqual(expect.any(String));
    });

    it("returns 401 on bad credentials", async () => {
      const { HttpError } = await import("../src/middlewares/error.middleware.js");
      vi.mocked(authService.loginUser).mockRejectedValue(
        new HttpError(401, "Invalid email or password"),
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "wrong" });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Invalid email or password" });
    });

    it("rejects a missing password with 400", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/google", () => {
    it("signs in with a Google credential", async () => {
      vi.mocked(authService.googleSignIn).mockResolvedValue(publicUser as never);

      const res = await request(app)
        .post("/api/auth/google")
        .send({ credential: "fake-google-id-token" });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
    });

    it("rejects a missing credential with 400", async () => {
      const res = await request(app).post("/api/auth/google").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("always returns { ok: true } (no account enumeration)", async () => {
      vi.mocked(authService.processForgotPassword).mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("resets the password and returns a token", async () => {
      vi.mocked(authService.processResetPassword).mockResolvedValue(publicUser as never);

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ email: "test@example.com", code: "123456", password: "newsecret" });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
    });

    it("rejects a wrong-length code with 400", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ email: "test@example.com", code: "12", password: "newsecret" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears the cookie and returns 204", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(204);
      expect(res.headers["set-cookie"]?.[0]).toMatch(/ajci_token=/);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns the authenticated user with a valid Bearer token", async () => {
      vi.mocked(userRepo.findUserById).mockResolvedValue(testUser);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: testUser.id, email: testUser.email });
    });

    it("returns 401 without a token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Not authenticated" });
    });

    it("returns 401 with a malformed token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer garbage.token.value");
      expect(res.status).toBe(401);
    });

    it("returns 401 when the user no longer exists", async () => {
      vi.mocked(userRepo.findUserById).mockResolvedValue(null);
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", authHeader());
      expect(res.status).toBe(401);
    });
  });
});
