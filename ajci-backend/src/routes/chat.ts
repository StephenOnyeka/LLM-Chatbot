import { Router } from "express";
import { z } from "zod";
import { streamReply } from "../lib/gemini.js";
import { startSSE, writeSSE, writeSSEDone, writeSSEEvent } from "../lib/sse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { getOwned, rename, touch } from "../repos/conversations.js";
import { append, countForConversation, listAsGeminiHistory } from "../repos/messages.js";

const router = Router();
router.use(requireAuth);

const ChatBody = z.object({ content: z.string().trim().min(1).max(8000) });

router.post(
  "/:id/chat",
  asyncHandler(async (req, res) => {
    const conversation = await getOwned(req.params.id!, req.user!.id);
    if (!conversation) throw new HttpError(404, "Session not found");

    const { content } = ChatBody.parse(req.body);

    const wasEmpty = (await countForConversation(conversation.id)) === 0;

    await append(conversation.id, "user", content);
    const history = await listAsGeminiHistory(conversation.id);

    startSSE(res);

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    let assembled = "";
    try {
      for await (const delta of streamReply(history)) {
        if (aborted) break;
        assembled += delta;
        writeSSE(res, { token: delta });
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

    if (assembled.length > 0) {
      try {
        await append(conversation.id, "assistant", assembled);
      } catch (err) {
        console.error("Failed to persist assistant message:", err);
      }
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
