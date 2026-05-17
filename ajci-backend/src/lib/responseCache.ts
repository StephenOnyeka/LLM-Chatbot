import { createHash } from "node:crypto";
import type { GeminiTurn } from "./gemini.js";
import { getRedis } from "./redis.js";

export const RESPONSE_CACHE_TTL_SEC = 86_400; // 24h

// Pin the canonical form so future additions to GeminiTurn (tool calls etc.)
// don't accidentally change every existing key.
export function hashPromptKey(model: string, history: GeminiTurn[]): string {
  const canonical = JSON.stringify({
    model,
    history: history.map((t) => ({
      role: t.role,
      parts: t.parts.map((p) => ({ text: p.text })),
    })),
  });
  const hex = createHash("sha256").update(canonical).digest("hex");
  return `resp:${hex}`;
}

export async function getCachedReply(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null; // treat any error as a miss
  }
}

export async function setCachedReply(
  key: string,
  reply: string,
  ttlSec: number = RESPONSE_CACHE_TTL_SEC,
): Promise<void> {
  try {
    await getRedis().set(key, reply, "EX", ttlSec);
  } catch {
    // swallow — cache writes are best-effort
  }
}
