import { Worker, type Job } from "bullmq";
import { AI_JOBS_QUEUE, type AiJobData } from "../utils/queue.js";
import { bullmqConnectionOptions } from "../utils/redis.js";

// Runs as a separate process via `npm run worker`. Not auto-started from
// src/index.ts — BullMQ's recommended deployment model is a dedicated worker
// process per queue.
const worker = new Worker<AiJobData>(
  AI_JOBS_QUEUE,
  async (job: Job<AiJobData>) => {
    console.log(`[aiWorker] received job ${job.id}`, job.data);
    // TODO: hand off to gemini / persist results when producers are wired.
    return { ok: true };
  },
  { connection: bullmqConnectionOptions(), concurrency: 2 },
);

worker.on("ready", () => console.log("✓ aiWorker ready"));
worker.on("failed", (job, err) =>
  console.error(`[aiWorker] ${job?.id ?? "<unknown>"} failed:`, err),
);
worker.on("error", (err) => console.error("[aiWorker] error:", err.message));

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[aiWorker] ${signal} received, closing...`);
  try {
    await worker.close();
  } catch (err) {
    console.error("[aiWorker] error during close:", (err as Error).message);
  }
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
