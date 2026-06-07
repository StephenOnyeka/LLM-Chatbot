import { query } from "../db.js";
import type { GeminiTurn } from "../lib/gemini.js";
import { getRedis } from "../lib/redis.js";
import type { ChatRole, Message } from "../types.js";

interface Row {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  created_at: Date;
}

function toMessage(r: Row): Message {
  return {
    id: r.id,
    sessionId: r.conversation_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at.toISOString(),
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
    `select id, conversation_id, role, content, created_at
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
): Promise<Message> {
  const { rows } = await query<Row>(
    `insert into messages (conversation_id, role, content)
     values ($1, $2, $3)
     returning id, conversation_id, role, content, created_at`,
    [conversationId, role, content],
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
  return messages.slice(-limit).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export async function countForConversation(conversationId: string): Promise<number> {
  const messages = await getCachedMessages(conversationId);
  return messages.length;
}
