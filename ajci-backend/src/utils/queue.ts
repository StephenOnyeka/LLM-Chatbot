import { Queue } from "bullmq";
import { bullmqConnectionOptions } from "./redis.js";

export const AI_JOBS_QUEUE = "ai-jobs";

export interface AiJobData {
  conversationId: string;
  userId: string;
  // future: prompt, model, attachments, etc.
}

// No producers wired in this round. The queue is exported so future routes
// can push heavy/async jobs; the worker in src/workers/aiWorker.ts consumes.
export const aiQueue = new Queue<AiJobData>(AI_JOBS_QUEUE, {
  connection: bullmqConnectionOptions(),
});
