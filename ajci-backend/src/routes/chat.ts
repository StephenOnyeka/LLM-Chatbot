import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { streamReply } from "../lib/gemini.js";
import {
  getCachedReply,
  hashPromptKey,
  setCachedReply,
} from "../lib/responseCache.js";
import { startSSE, writeSSE, writeSSEDone, writeSSEEvent } from "../lib/sse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getOwned, rename, touch } from "../repos/conversations.js";
import { append, countForConversation, listAsGeminiHistory } from "../repos/messages.js";

const router = Router();
router.use(requireAuth);

const ChatBody = z.object({ content: z.string().trim().min(1).max(8000) });

const CACHE_REPLAY_CHUNK = 40;

router.post(
  "/:id/chat",
  rateLimit({ bucket: "chat", limit: env.RATE_LIMIT_CHAT_PER_MINUTE }),
  asyncHandler(async (req, res) => {
    const conversation = await getOwned(req.params.id!, req.user!.id);
    if (!conversation) throw new HttpError(404, "Session not found");

    const { content } = ChatBody.parse(req.body);

    const wasEmpty = (await countForConversation(conversation.id)) === 0;

    await append(conversation.id, "user", content);
    const history = await listAsGeminiHistory(conversation.id);

    const cacheKey = hashPromptKey(req.user!.id, env.GEMINI_MODEL, history);
    const cached = await getCachedReply(cacheKey);

    startSSE(res);

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    let assembled = "";
    try {
      if (cached !== null) {
        // Cache hit — replay through the SSE protocol so the frontend sees
        // identical framing. No artificial delay; instant is fine.
        assembled = cached;
        for (let i = 0; i < cached.length; i += CACHE_REPLAY_CHUNK) {
          if (aborted) break;
          writeSSE(res, { token: cached.slice(i, i + CACHE_REPLAY_CHUNK) });
        }
      } else {
        for await (const delta of streamReply(history)) {
          if (aborted) break;
          assembled += delta;
          writeSSE(res, { token: delta });
        }
      }

      if (!aborted) {
        writeSSEDone(res);
        res.end();
      }
    } catch (err) {
      console.error("Gemini stream failed:", err);
      if (!aborted && !res.writableEnded) {
        writeSSEEvent(res, "error", { message: "stream failed" });
        res.end();
      }
    }

    // Persist assistant message regardless of cache vs live (so message history
    // is consistent in PG either way).
    if (assembled.length > 0) {
      try {
        await append(conversation.id, "assistant", assembled);
      } catch (err) {
        console.error("Failed to persist assistant message:", err);
      }
    }

    // Only populate the cache on a successful live generation. Cache hits skip
    // this naturally; aborted or empty streams don't poison the cache.
    if (cached === null && !aborted && assembled.length > 0) {
      void setCachedReply(cacheKey, assembled);
    }

    try {
      if (wasEmpty && conversation.title === "New chat") {
        const title = content.length > 60 ? `${content.slice(0, 60)}…` : content;
        await rename(conversation.id, title);
      } else {
        await touch(conversation.id);
      }
    } catch (err) {
      console.error("Failed to update conversation metadata:", err);
    }
  }),
);

export default router;
