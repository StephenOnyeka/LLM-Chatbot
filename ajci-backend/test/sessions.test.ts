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

// All /api/sessions routes are behind requireAuth → findUserById.
vi.mock("../src/repositories/user.repository.js", () => ({
  findUserById: vi.fn(),
}));

// Mock the sessions service so no DB is touched; real routing + validators run.
vi.mock("../src/services/sessions.service.js", () => ({
  getUserSessions: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSessionMessages: vi.fn(),
}));

const userRepo = await import("../src/repositories/user.repository.js");
const sessionsService = await import("../src/services/sessions.service.js");
const { HttpError } = await import("../src/middlewares/error.middleware.js");
const { createApp } = await import("../src/app.js");
const app = createApp();

const sampleSession = {
  id: "sess-1",
  title: "New chat",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("sessions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepo.findUserById).mockResolvedValue(testUser);
  });

  it("GET /api/sessions requires auth", async () => {
    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(401);
  });

  it("GET /api/sessions returns the user's sessions", async () => {
    vi.mocked(sessionsService.getUserSessions).mockResolvedValue([sampleSession] as never);

    const res = await request(app)
      .get("/api/sessions")
      .set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([sampleSession]);
    expect(sessionsService.getUserSessions).toHaveBeenCalledWith(testUser.id);
  });

  it("POST /api/sessions creates a session (201)", async () => {
    vi.mocked(sessionsService.createSession).mockResolvedValue(sampleSession as never);

    const res = await request(app)
      .post("/api/sessions")
      .set("Authorization", authHeader())
      .send({ title: "My chat" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(sampleSession);
    expect(sessionsService.createSession).toHaveBeenCalledWith(testUser.id, {
      title: "My chat",
    });
  });

  it("POST /api/sessions accepts an empty body (title optional)", async () => {
    vi.mocked(sessionsService.createSession).mockResolvedValue(sampleSession as never);

    const res = await request(app)
      .post("/api/sessions")
      .set("Authorization", authHeader())
      .send({});

    expect(res.status).toBe(201);
    expect(sessionsService.createSession).toHaveBeenCalledWith(testUser.id, {});
  });

  it("POST /api/sessions rejects a blank title with 400", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set("Authorization", authHeader())
      .send({ title: "   " });

    expect(res.status).toBe(400);
    expect(sessionsService.createSession).not.toHaveBeenCalled();
  });

  it("DELETE /api/sessions/:id returns 204 on success", async () => {
    vi.mocked(sessionsService.deleteSession).mockResolvedValue(undefined);

    const res = await request(app)
      .delete("/api/sessions/sess-1")
      .set("Authorization", authHeader());

    expect(res.status).toBe(204);
    expect(sessionsService.deleteSession).toHaveBeenCalledWith("sess-1", testUser.id);
  });

  it("DELETE /api/sessions/:id returns 404 when not owned", async () => {
    vi.mocked(sessionsService.deleteSession).mockRejectedValue(
      new HttpError(404, "Session not found"),
    );

    const res = await request(app)
      .delete("/api/sessions/nope")
      .set("Authorization", authHeader());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Session not found" });
  });

  it("GET /api/sessions/:id/messages returns messages", async () => {
    const messages = [
      { id: "m1", sessionId: "sess-1", role: "user", content: "hi", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    vi.mocked(sessionsService.getSessionMessages).mockResolvedValue(messages as never);

    const res = await request(app)
      .get("/api/sessions/sess-1/messages")
      .set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(messages);
    expect(sessionsService.getSessionMessages).toHaveBeenCalledWith("sess-1", testUser.id);
  });

  it("GET /api/sessions/:id/messages returns 404 for an unknown session", async () => {
    vi.mocked(sessionsService.getSessionMessages).mockRejectedValue(
      new HttpError(404, "Session not found"),
    );

    const res = await request(app)
      .get("/api/sessions/unknown/messages")
      .set("Authorization", authHeader());

    expect(res.status).toBe(404);
  });
});
