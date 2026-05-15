import { query } from "../db.js";
import type { Session } from "../types.js";

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
  const { rows } = await query<Row>(
    `select id, title, created_at, updated_at
     from conversations
     where user_id = $1
     order by updated_at desc`,
    [userId],
  );
  return rows.map(toSession);
}

export async function createForUser(userId: string, title = "New chat"): Promise<Session> {
  const { rows } = await query<Row>(
    `insert into conversations (user_id, title)
     values ($1, $2)
     returning id, title, created_at, updated_at`,
    [userId, title],
  );
  return toSession(rows[0]!);
}

export async function deleteOwned(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `delete from conversations where id = $1 and user_id = $2`,
    [id, userId],
  );
  return (rowCount ?? 0) > 0;
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

export async function touch(id: string): Promise<void> {
  await query(`update conversations set updated_at = now() where id = $1`, [id]);
}

export async function rename(id: string, title: string): Promise<void> {
  await query(`update conversations set title = $2, updated_at = now() where id = $1`, [
    id,
    title,
  ]);
}
