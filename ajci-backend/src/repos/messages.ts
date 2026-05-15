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

export async function listAsGeminiHistory(conversationId: string): Promise<GeminiTurn[]> {
  const { rows } = await query<{ role: ChatRole; content: string }>(
    `select role, content
     from messages
     where conversation_id = $1
     order by created_at asc`,
    [conversationId],
  );
  return rows.map((r) => ({
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
