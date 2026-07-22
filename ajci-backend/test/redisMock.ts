import { vi } from "vitest";

// A minimal in-memory-ish stub matching the ioredis surface the app touches
// (rate limiter: multi/incr/expire/exec; caches: get/set/del/ping/quit).
// Rate-limit reads return a low count so requests are never throttled in tests;
// cache reads return null so repositories fall through to their (mocked) DB.
export function makeRedisStub() {
  const multi = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 1],
      [null, 1],
    ]),
  };
  return {
    multi: vi.fn(() => multi),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue("PONG"),
    quit: vi.fn().mockResolvedValue("OK"),
  };
}
