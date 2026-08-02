import { query } from "../config/database.js";
import { getRedis } from "../utils/redis.js";
import type { Session } from "../types/index.js";

// Mirror of the history cache key in repos/messages.ts. Deleting a conversation
// cascades to its messages in PG, so the cached history must be dropped too.
const historyCacheKey = (conversationId: string) => `chat:history:${conversationId}`;

// The per-user session list (sidebar) is read on every app load. It's cached
// cache-aside in Redis and invalidated by every path that changes the list:
// create, delete, rename, and touch (which reorders by updated_at). The TTL is
// just a safety net against a missed invalidation. All Redis calls fail open.
const SESSIONS_CACHE_TTL_SEC = 300; // 5 min
const sessionsCacheKey = (userId: string) => `sessions:${userId}`;

async function invalidateSessions(userId: string): Promise<void> {
  try {
    await getRedis().del(sessionsCacheKey(userId));
  } catch {
    // best-effort — a stale key still expires via TTL
  }
}

interface Row {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

function toSession(r: Row): Session {
  return {
    id: r.id,
    title: r.title,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listForUser(userId: string): Promise<Session[]> {
  const key = sessionsCacheKey(userId);

  try {
    const cached = await getRedis().get(key);
    if (cached) return JSON.parse(cached) as Session[];
  } catch {
    // cache read failed — fall through to the DB
  }

  const { rows } = await query<Row>(
    `select id, title, created_at, updated_at
     from conversations
     where user_id = $1
     order by updated_at desc`,
    [userId],
  );
  const sessions = rows.map(toSession);

  try {
    await getRedis().set(key, JSON.stringify(sessions), "EX", SESSIONS_CACHE_TTL_SEC);
  } catch {
    // cache write is best-effort
  }

  return sessions;
}

export async function createForUser(userId: string, title = "New chat"): Promise<Session> {
  const { rows } = await query<Row>(
    `insert into conversations (user_id, title)
     values ($1, $2)
     returning id, title, created_at, updated_at`,
    [userId, title],
  );
  await invalidateSessions(userId);
  return toSession(rows[0]!);
}

export async function deleteOwned(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `delete from conversations where id = $1 and user_id = $2`,
    [id, userId],
  );
  const deleted = (rowCount ?? 0) > 0;
  if (deleted) {
    await invalidateSessions(userId);
    try {
      await getRedis().del(historyCacheKey(id));
    } catch {
      // best-effort — a stale key still expires via TTL
    }
  }
  return deleted;
}

export async function getOwned(id: string, userId: string): Promise<Session | null> {
  const { rows } = await query<Row>(
    `select id, title, created_at, updated_at
     from conversations
     where id = $1 and user_id = $2`,
    [id, userId],
  );
  const r = rows[0];
  return r ? toSession(r) : null;
}

export async function touch(id: string, userId: string): Promise<void> {
  await query(`update conversations set updated_at = now() where id = $1`, [id]);
  await invalidateSessions(userId);
}

export async function rename(id: string, title: string, userId: string): Promise<void> {
  await query(`update conversations set title = $2, updated_at = now() where id = $1`, [
    id,
    title,
  ]);
  await invalidateSessions(userId);
}
