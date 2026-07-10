import { env } from "../config/env.js";
import { getCachedReply, hashPromptKey, setCachedReply } from "../utils/responseCache.js";
import { getOwned, rename, touch } from "../repositories/conversation.repository.js";
import { append, countForConversation, listAsGeminiHistory } from "../repositories/message.repository.js";
import { HttpError } from "../middlewares/error.middleware.js";
import type { Attachment } from "../types/index.js";
import { z } from "zod";
import { ChatBody } from "../validators/chat.validator.js";

export async function processChatRequest(
  conversationId: string,
  userId: string,
  isPro: boolean,
  body: z.infer<typeof ChatBody>
) {
  const conversation = await getOwned(conversationId, userId);
  if (!conversation) throw new HttpError(404, "Session not found");

  const { content, attachments } = body;

  if (!content && (!attachments || attachments.length === 0)) {
    throw new HttpError(400, "Message must have content or attachments.");
  }

  if (attachments && attachments.length > 0 && !isPro) {
    throw new HttpError(403, "File uploads require a Pro plan.");
  }

  const wasEmpty = (await countForConversation(conversation.id)) === 0;

  await append(conversation.id, "user", content, attachments as Attachment[] | undefined);
  const history = await listAsGeminiHistory(conversation.id);

  const cacheKey = hashPromptKey(userId, env.GEMINI_MODEL, history);
  const cached = await getCachedReply(cacheKey);

  return { conversation, wasEmpty, history, cacheKey, cached };
}

export async function persistAssistantMessage(conversationId: string, assembled: string, cacheKey: string, wasCached: boolean, aborted: boolean) {
  if (assembled.length > 0) {
    try {
      await append(conversationId, "assistant", assembled);
    } catch (err) {
      console.error("Failed to persist assistant message:", err);
    }
  }

  if (!wasCached && !aborted && assembled.length > 0) {
    void setCachedReply(cacheKey, assembled);
  }
}

export async function updateConversationMetadata(
  conversationId: string,
  userId: string,
  wasEmpty: boolean,
  currentTitle: string,
  content: string,
  attachments?: z.infer<typeof ChatBody>["attachments"]
) {
  try {
    if (wasEmpty && currentTitle === "New chat") {
      let titleText = content;
      if (!titleText && attachments && attachments.length > 0) {
        titleText = `File: ${attachments[0]?.name || "upload"}`;
      }
      const title = titleText.length > 60 ? `${titleText.slice(0, 60)}…` : (titleText || "New chat");
      await rename(conversationId, title, userId);
    } else {
      await touch(conversationId, userId);
    }
  } catch (err) {
    console.error("Failed to update conversation metadata:", err);
  }
}
