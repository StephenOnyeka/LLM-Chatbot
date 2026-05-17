import { createApp } from "./app.js";
import { env } from "./config.js";
import { query } from "./db.js";
import { pingRedis, quitRedis } from "./lib/redis.js";

const app = createApp();

try {
  const { rows } = await query<{ db: string }>("select current_database() as db");
  console.log(`✓ Database connected (${rows[0]?.db ?? "unknown"})`);
} catch (err) {
  console.error("✗ Database connection failed:", (err as Error).message);
  process.exit(1);
}

// Redis is optional at boot — fail-open. Rate limiter and cache degrade
// gracefully if it's unreachable.
try {
  await pingRedis();
} catch (err) {
  console.warn(
    "⚠ Redis ping failed, continuing in degraded mode:",
    (err as Error).message,
  );
}

const server = app.listen(env.PORT, () => {
  console.log(`ajci-backend listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => {
    void quitRedis().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
