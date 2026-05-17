import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config.js";

// One general-purpose connection for the cache + rate limiter. BullMQ's Queue
// and Worker need their own connections (see bullmqConnectionOptions below),
// so they intentionally do not share this client.
let client: Redis | null = null;

// Throttle error logs so a hard-down Redis doesn't flood the console. Track
// suppressed-count so the next emitted line tells you how noisy it really was.
let lastErrorLoggedAt = 0;
let suppressedSinceLastLog = 0;
const ERROR_LOG_INTERVAL_MS = 30_000;

function logErrorThrottled(prefix: string, err: Error): void {
  const now = Date.now();
  if (now - lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) {
    suppressedSinceLastLog += 1;
    return;
  }
  lastErrorLoggedAt = now;
  // ioredis errors sometimes carry the useful info on .code (e.g. ECONNREFUSED)
  // rather than .message — surface both so the log is actually diagnosable.
  const code = (err as NodeJS.ErrnoException).code;
  const parts = [err.message, code ? `code=${code}` : null].filter(Boolean);
  const suffix = suppressedSinceLastLog > 0
    ? ` (+${suppressedSinceLastLog} suppressed)`
    : "";
  suppressedSinceLastLog = 0;
  console.warn(`${prefix}: ${parts.join(" ") || err.name || "unknown error"}${suffix}`);
}

export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    enableOfflineQueue: true,
  });
  client.on("error", (err: Error) => logErrorThrottled("Redis client error", err));
  client.on("connect", () => console.log("✓ Redis connected"));
  return client;
}

export async function pingRedis(): Promise<void> {
  const pong = await getRedis().ping();
  if (pong !== "PONG") throw new Error(`unexpected ping reply: ${pong}`);
}

export async function quitRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    // swallow — we're shutting down
  }
  client = null;
}

// BullMQ requires its own connection with maxRetriesPerRequest:null and
// enableReadyCheck:false. Each Queue/Worker constructs its own connection
// using this factory so they don't fight over a single socket.
export function bullmqConnectionOptions(): RedisOptions {
  const url = new URL(env.REDIS_URL);
  const opts: RedisOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
  if (url.username) opts.username = decodeURIComponent(url.username);
  if (url.password) opts.password = decodeURIComponent(url.password);
  if (url.pathname && url.pathname !== "/") {
    const db = Number(url.pathname.slice(1));
    if (Number.isFinite(db)) opts.db = db;
  }
  if (url.protocol === "rediss:") opts.tls = {};
  return opts;
}
