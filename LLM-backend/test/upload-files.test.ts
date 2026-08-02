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

// upload/files controllers use pool.query directly.
const poolQuery = vi.fn();
vi.mock("../src/config/database.js", () => ({
  pool: { query: poolQuery },
  query: vi.fn(),
}));
vi.mock("../src/repositories/user.repository.js", () => ({
  findUserById: vi.fn(),
}));

const userRepo = await import("../src/repositories/user.repository.js");
const { createApp } = await import("../src/app.js");
const app = createApp();

describe("upload API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolQuery.mockReset();
  });

  it("POST /api/upload requires auth", async () => {
    const res = await request(app).post("/api/upload");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-Pro user", async () => {
    vi.mocked(userRepo.findUserById).mockResolvedValue(testUser); // isPro: false

    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", authHeader(testUser.id))
      .attach("file", Buffer.from("hello"), {
        filename: "note.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Pro plan/);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it("stores an allowed file for a Pro user and returns 201 + metadata", async () => {
    vi.mocked(userRepo.findUserById).mockResolvedValue(testProUser);
    poolQuery.mockResolvedValue({ rows: [{ id: "file-1" }], rowCount: 1 });

    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", authHeader(testProUser.id))
      .attach("file", Buffer.from("PNGDATA"), {
        filename: "pic.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: "file-1",
      name: "pic.png",
      mimeType: "image/png",
      url: "http://localhost:4000/api/files/file-1",
    });
    expect(poolQuery).toHaveBeenCalledOnce();
  });

  it("rejects a disallowed file type with 400", async () => {
    vi.mocked(userRepo.findUserById).mockResolvedValue(testProUser);

    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", authHeader(testProUser.id))
      .attach("file", Buffer.from("MZ..."), {
        filename: "virus.exe",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(400);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is attached", async () => {
    vi.mocked(userRepo.findUserById).mockResolvedValue(testProUser);

    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", authHeader(testProUser.id));

    expect(res.status).toBe(400);
  });
});

describe("files API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolQuery.mockReset();
  });

  it("GET /api/files/:id serves a stored file with caching headers", async () => {
    poolQuery.mockResolvedValue({
      rowCount: 1,
      rows: [
        { filename: "pic.png", mime_type: "image/png", data: Buffer.from("PNGDATA") },
      ],
    });

    const res = await request(app).get("/api/files/file-1");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-disposition"]).toContain('filename="pic.png"');
    expect(res.headers["etag"]).toBe('"file-1"');
    expect(res.headers["cache-control"]).toMatch(/immutable/);
  });

  it("returns 304 when If-None-Match matches the ETag", async () => {
    const res = await request(app)
      .get("/api/files/file-1")
      .set("If-None-Match", '"file-1"');

    expect(res.status).toBe(304);
    // short-circuits before hitting the DB
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown file id", async () => {
    poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });

    const res = await request(app).get("/api/files/missing");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "File not found" });
  });

  it("does not require authentication (public files route)", async () => {
    poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    const res = await request(app).get("/api/files/anything");
    // 404 (not 401) proves the route is reachable without a token
    expect(res.status).toBe(404);
  });
});
