import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeRedisStub } from "./redisMock.js";

// Redis is used by the global rate limiter on /api routes. Stub it so no real
// connection is attempted. (health/docs don't hit /api but we mock globally to
// keep the module graph free of live connections.)
const redisStub = makeRedisStub();
vi.mock("../src/utils/redis.js", () => ({
  getRedis: () => redisStub,
  pingRedis: vi.fn().mockResolvedValue(undefined),
  quitRedis: vi.fn().mockResolvedValue(undefined),
  bullmqConnectionOptions: () => ({}),
}));

// Database is imported transitively; stub query/pool so nothing connects.
vi.mock("../src/config/database.js", () => ({
  pool: { query: vi.fn() },
  query: vi.fn(),
}));

const { createApp } = await import("../src/app.js");
const app = createApp();

describe("infrastructure endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("GET /docs.json returns an OpenAPI spec", async () => {
    const res = await request(app).get("/docs.json");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("openapi");
    expect(res.body).toHaveProperty("paths");
  });

  it("unknown route returns 404 with a JSON message", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Not found" });
  });

  it("rejects a disallowed CORS origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example.com");
    // origin callback returns false → no allow-origin header echoed back
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
