import { query } from "../db.js";
import { getRedis } from "../lib/redis.js";
import type { User } from "../types.js";

// findUserById runs on every authenticated request (middleware/auth.ts), so its
// result is cached in Redis to avoid a DB round-trip per request. Only positive
// lookups are cached; a missing user is never cached, so the value shape stays
// User (never null). Users are only ever created in this codebase — there is no
// update/delete path — so no invalidation is needed. NOTE: if a user update or
// delete path is ever added, it MUST `del user:<id>` to avoid stale identity.
const USER_CACHE_TTL_SEC = 300; // 5 min
const userCacheKey = (id: string) => `user:${id}`;

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string,
): Promise<User> {
  const { rows } = await query<UserRow>(
    `insert into users (email, name, password_hash)
     values ($1, $2, $3)
     returning id, email, name, password_hash`,
    [email.toLowerCase(), name, passwordHash],
  );
  const row = rows[0]!;
  return { id: row.id, email: row.email, name: row.name };
}

export async function findUserByEmail(
  email: string,
): Promise<(User & { passwordHash: string }) | null> {
  const { rows } = await query<UserRow>(
    `select id, email, name, password_hash from users where email = $1`,
    [email.toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash };
}

export async function findUserById(id: string): Promise<User | null> {
  const key = userCacheKey(id);

  try {
    const cached = await getRedis().get(key);
    if (cached) return JSON.parse(cached) as User;
  } catch {
    // cache read failed — fall through to the DB
  }

  const { rows } = await query<UserRow>(
    `select id, email, name, password_hash from users where id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null; // don't cache negative lookups
  const user: User = { id: row.id, email: row.email, name: row.name };

  try {
    await getRedis().set(key, JSON.stringify(user), "EX", USER_CACHE_TTL_SEC);
  } catch {
    // cache write is best-effort
  }

  return user;
}
