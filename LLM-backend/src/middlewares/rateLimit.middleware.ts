import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getRedis } from "../utils/redis.js";
import { HttpError } from "./error.middleware.js";

export interface RateLimitOptions {
  bucket: string; // e.g. "global" | "auth" | "chat"
  limit: number; // requests allowed per window
  windowSec?: number; // default 60
}

// Throttle rate-limiter Redis error logs separately from the main client logs
// so a 1-rps stream of requests doesn't repaint the same error.
let lastErrorLoggedAt = 0;
let suppressedSinceLastLog = 0;
const ERROR_LOG_INTERVAL_MS = 30_000;

function logRedisError(err: Error): void {
  const now = Date.now();
  if (now - lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) {
    suppressedSinceLastLog += 1;
    return;
  }
  lastErrorLoggedAt = now;
  const code = (err as NodeJS.ErrnoException).code;
  const parts = [err.message, code ? `code=${code}` : null].filter(Boolean);
  const suffix = suppressedSinceLastLog > 0
    ? ` (+${suppressedSinceLastLog} suppressed)`
    : "";
  suppressedSinceLastLog = 0;
  console.warn(
    `rateLimit Redis error: ${parts.join(" ") || err.name || "unknown error"}${suffix}`,
  );
}

function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const windowSec = opts.windowSec ?? 60;
  const limit = opts.limit;
  const bucket = opts.bucket;

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const key = `rl:${bucket}:${clientKey(req)}`;
    let count: number;
    try {
      // INCR then EXPIRE NX in a single round trip. The NX flag (Redis 7+)
      // sets the TTL only when none exists yet, avoiding the race where a
      // crash between INCR and EXPIRE leaves a key without a TTL.
      const r = getRedis();
      const result = await r
        .multi()
        .incr(key)
        .expire(key, windowSec, "NX")
        .exec();
      // result is [[null, count], [null, 0|1]] when the pipeline succeeds
      if (!result || result[0] == null) throw new Error("empty pipeline result");
      const [incrErr, incrVal] = result[0] as [Error | null, number];
      if (incrErr) throw incrErr;
      count = Number(incrVal);
    } catch (err) {
      logRedisError(err as Error);
      next(); // fail-open
      return;
    }

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));
    res.setHeader(
      "X-RateLimit-Reset",
      Math.floor(Date.now() / 1000) + windowSec,
    );

    if (count > limit) {
      res.setHeader("Retry-After", windowSec);
      next(new HttpError(429, "Too many requests"));
      return;
    }

    next();
  };
}
