import { Request, Response } from "express";
import { ChatBody } from "../validators/chat.validator.js";
import {
  processChatRequest,
  persistAssistantMessage,
  updateConversationMetadata,
} from "../services/chat.service.js";
import { startSSE, writeSSE, writeSSEDone, writeSSEEvent } from "../utils/sse.js";
import { streamReply } from "../utils/gemini.js";

const CACHE_REPLAY_CHUNK = 40;

export async function chat(req: Request, res: Response) {
  const body = ChatBody.parse(req.body);
  const { content, attachments } = body;

  const { conversation, wasEmpty, history, cacheKey, cached } = await processChatRequest(
    req.params.id!,
    req.user!.id,
    req.user!.isPro ?? false,
    body
  );

  startSSE(res);

  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  let assembled = "";
  try {
    if (cached !== null) {
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

  await persistAssistantMessage(conversation.id, assembled, cacheKey, cached !== null, aborted);
  await updateConversationMetadata(conversation.id, req.user!.id, wasEmpty, conversation.title, content, attachments);
}
