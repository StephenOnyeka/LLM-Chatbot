import { query } from "../db.js";
import type { GeminiTurn } from "../lib/gemini.js";
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

export async function listForConversation(conversationId: string): Promise<Message[]> {
  const { rows } = await query<Row>(
    `select id, conversation_id, role, content, created_at
     from messages
     where conversation_id = $1
     order by created_at asc`,
    [conversationId],
  );
  return rows.map(toMessage);
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
  // Grab the most recent N rows (newest-first), then reverse to oldest-first
  // because Gemini expects chronological order.
  const { rows } = await query<{ role: ChatRole; content: string }>(
    `select role, content
     from messages
     where conversation_id = $1
     order by created_at desc
     limit $2`,
    [conversationId, limit],
  );
  return rows.reverse().map((r) => ({
    role: r.role === "assistant" ? "model" : "user",
    parts: [{ text: r.content }],
  }));
}

export async function countForConversation(conversationId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `select count(*)::text as count from messages where conversation_id = $1`,
    [conversationId],
  );
  return Number(rows[0]?.count ?? 0);
}
