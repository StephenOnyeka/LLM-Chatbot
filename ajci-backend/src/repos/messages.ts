import { query } from "../db.js";
import type { GeminiTurn } from "../lib/gemini.js";
import { getRedis } from "../lib/redis.js";
import type { Attachment, ChatRole, Message } from "../types.js";

// MIME types Gemini accepts as inlineData. Anything the upload route allows
// but isn't here (svg, doc/docx, xls/xlsx) must NOT be sent inline.
const GEMINI_INLINE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

interface Row {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  created_at: Date;
  attachments: Attachment[] | null;
}

function toMessage(r: Row): Message {
  return {
    id: r.id,
    sessionId: r.conversation_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at.toISOString(),
    attachments: r.attachments ?? undefined,
  };
}

// A conversation's full message list is read both by the /messages endpoint and
// (sliced) on every chat turn, so it's cached in Redis as the single source of
// truth. createdAt is already an ISO string, so JSON round-trips losslessly.
// Any write to the conversation must invalidate this key (see append +
// deleteOwned). All Redis calls fail open to the DB.
const HISTORY_CACHE_TTL_SEC = 1800; // 30 min
const historyCacheKey = (conversationId: string) => `chat:history:${conversationId}`;

async function invalidateHistory(conversationId: string): Promise<void> {
  try {
    await getRedis().del(historyCacheKey(conversationId));
  } catch {
    // best-effort — a stale key still expires via TTL
  }
}

// Cache-aside read of the full oldest-first message list for a conversation.
async function getCachedMessages(conversationId: string): Promise<Message[]> {
  const key = historyCacheKey(conversationId);

  try {
    const cached = await getRedis().get(key);
    if (cached) return JSON.parse(cached) as Message[];
  } catch {
    // cache read failed — fall through to the DB
  }

  const { rows } = await query<Row>(
    `select id, conversation_id, role, content, created_at, attachments
     from messages
     where conversation_id = $1
     order by created_at asc`,
    [conversationId],
  );
  const messages = rows.map(toMessage);

  try {
    await getRedis().set(key, JSON.stringify(messages), "EX", HISTORY_CACHE_TTL_SEC);
  } catch {
    // cache write is best-effort
  }

  return messages;
}

export async function listForConversation(conversationId: string): Promise<Message[]> {
  return getCachedMessages(conversationId);
}

export async function append(
  conversationId: string,
  role: ChatRole,
  content: string,
  attachments?: Attachment[],
): Promise<Message> {
  const { rows } = await query<Row>(
    `insert into messages (conversation_id, role, content, attachments)
     values ($1, $2, $3, $4)
     returning id, conversation_id, role, content, created_at, attachments`,
    [conversationId, role, content, attachments ? JSON.stringify(attachments) : null],
  );
  // A new message changes the cached history — drop it so the next read repopulates.
  await invalidateHistory(conversationId);
  return toMessage(rows[0]!);
}

// Default sliding-window size for Gemini context. Every turn beyond this is
// kept in Postgres (and still rendered in the UI) but not sent to the model,
// so token cost per turn stays bounded as a conversation grows.
export const GEMINI_HISTORY_LIMIT = 20;

export async function listAsGeminiHistory(
  conversationId: string,
  limit: number = GEMINI_HISTORY_LIMIT,
): Promise<GeminiTurn[]> {
  // Derive from the cached full list: the last `limit` messages, already
  // oldest-first (the order Gemini expects).
  const messages = await getCachedMessages(conversationId);
  const slice = messages.slice(-limit);

  const turns: GeminiTurn[] = [];
  for (const m of slice) {
    const parts: GeminiTurn["parts"] = [];

    // Include any file attachments for the Gemini API. Gemini's inlineData
    // only accepts images, PDF, and plain text — sending any other type
    // throws and bricks the whole conversation (it replays every turn). So
    // only inline compatible types; reference the rest as a text note.
    if (m.attachments && m.attachments.length > 0) {
      for (const att of m.attachments) {
        if (GEMINI_INLINE_MIME_TYPES.has(att.mimeType)) {
          try {
            const { rows } = await query<{ data: Buffer }>(
              `select data from files where id = $1`,
              [att.id],
            );
            if (rows[0]) {
              parts.push({
                inlineData: {
                  mimeType: att.mimeType,
                  data: rows[0].data.toString("base64"),
                },
              });
            }
          } catch {
            // Row may have been deleted; skip gracefully
          }
        } else {
          parts.push({
            text: `[Attached file: ${att.name} (${att.mimeType}) — content not directly readable by the model.]`,
          });
        }
      }
    }

    if (m.content) {
      parts.push({ text: m.content });
    }

    if (parts.length > 0) {
      turns.push({
        role: m.role === "assistant" ? "model" : "user",
        parts,
      });
    }
  }

  return turns;
}

export async function countForConversation(conversationId: string): Promise<number> {
  const messages = await getCachedMessages(conversationId);
  return messages.length;
}
