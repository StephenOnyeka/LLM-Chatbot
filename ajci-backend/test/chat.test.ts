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
vi.mock("../src/repositories/user.repository.js", () => ({
  findUserById: vi.fn(),
}));

// Mock the chat service (DB + cache) and the Gemini stream (network).
vi.mock("../src/services/chat.service.js", () => ({
  processChatRequest: vi.fn(),
  persistAssistantMessage: vi.fn().mockResolvedValue(undefined),
  updateConversationMetadata: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/utils/gemini.js", () => ({
  // async generator yielding a couple of tokens
  streamReply: vi.fn(async function* () {
    yield "Hello";
    yield " world";
  }),
}));

const userRepo = await import("../src/repositories/user.repository.js");
const chatService = await import("../src/services/chat.service.js");
const gemini = await import("../src/utils/gemini.js");
const { HttpError } = await import("../src/middlewares/error.middleware.js");
const { createApp } = await import("../src/app.js");
const app = createApp();

const conversation = { id: "sess-1", title: "New chat" };

describe("chat API (SSE)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepo.findUserById).mockResolvedValue(testUser);
  });

  it("POST /api/sessions/:id/chat requires auth", async () => {
    const res = await request(app).post("/api/sessions/sess-1/chat").send({ content: "hi" });
    expect(res.status).toBe(401);
  });

  it("streams Gemini tokens over SSE when not cached", async () => {
    vi.mocked(chatService.processChatRequest).mockResolvedValue({
      conversation,
      wasEmpty: true,
      history: [],
      cacheKey: "key-1",
      cached: null,
    } as never);

    const res = await request(app)
      .post("/api/sessions/sess-1/chat")
      .set("Authorization", authHeader())
      .send({ content: "hi" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    // tokens are emitted as SSE `data:` frames
    expect(res.text).toContain("Hello");
    expect(res.text).toContain("world");
    expect(gemini.streamReply).toHaveBeenCalledOnce();
    expect(chatService.persistAssistantMessage).toHaveBeenCalled();
  });

  it("replays a cached reply without calling Gemini", async () => {
    vi.mocked(chatService.processChatRequest).mockResolvedValue({
      conversation,
      wasEmpty: false,
      history: [],
      cacheKey: "key-1",
      cached: "cached answer",
    } as never);

    const res = await request(app)
      .post("/api/sessions/sess-1/chat")
      .set("Authorization", authHeader())
      .send({ content: "hi again" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("cached answer");
    expect(gemini.streamReply).not.toHaveBeenCalled();
  });

  it("returns 404 when the session isn't owned by the user", async () => {
    vi.mocked(chatService.processChatRequest).mockRejectedValue(
      new HttpError(404, "Session not found"),
    );

    const res = await request(app)
      .post("/api/sessions/other/chat")
      .set("Authorization", authHeader())
      .send({ content: "hi" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Session not found" });
  });

  it("returns 403 when attaching files without a Pro plan", async () => {
    vi.mocked(chatService.processChatRequest).mockRejectedValue(
      new HttpError(403, "File uploads require a Pro plan."),
    );

    const res = await request(app)
      .post("/api/sessions/sess-1/chat")
      .set("Authorization", authHeader())
      .send({
        content: "look",
        attachments: [
          { id: "f1", url: "/api/files/f1", name: "a.png", mimeType: "image/png" },
        ],
      });

    expect(res.status).toBe(403);
  });

  it("rejects content over the 8000-char limit with 400", async () => {
    const res = await request(app)
      .post("/api/sessions/sess-1/chat")
      .set("Authorization", authHeader())
      .send({ content: "x".repeat(8001) });

    expect(res.status).toBe(400);
    expect(chatService.processChatRequest).not.toHaveBeenCalled();
  });

  it("rejects more than 5 attachments with 400", async () => {
    const attachments = Array.from({ length: 6 }, (_, i) => ({
      id: `f${i}`,
      url: `/api/files/f${i}`,
      name: `a${i}.png`,
      mimeType: "image/png",
    }));

    const res = await request(app)
      .post("/api/sessions/sess-1/chat")
      .set("Authorization", authHeader())
      .send({ content: "hi", attachments });

    expect(res.status).toBe(400);
  });
});
