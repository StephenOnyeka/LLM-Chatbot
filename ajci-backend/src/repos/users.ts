import { query } from "../db.js";
import { getRedis } from "../lib/redis.js";
import type { User } from "../types.js";

// findUserById runs on every authenticated request (middleware/auth.ts), so its
// result is cached in Redis to avoid a DB round-trip per request. Only positive
// lookups are cached; a missing user is never cached, so the value shape stays
// User (never null). The only mutation path is updateUserPassword below, which
// invalidates user:<id>. Any future update/delete path MUST do the same to avoid
// stale identity.
const USER_CACHE_TTL_SEC = 300; // 5 min
const userCacheKey = (id: string) => `user:${id}`;

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  is_pro: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isPro: row.is_pro,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
  };
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string,
): Promise<User> {
  const { rows } = await query<UserRow>(
    `insert into users (email, name, password_hash)
     values ($1, $2, $3)
     returning id, email, name, password_hash, is_pro, stripe_customer_id, stripe_subscription_id`,
    [email.toLowerCase(), name, passwordHash],
  );
  return rowToUser(rows[0]!);
}

// Find an existing user by email, or create one with no password (Google sign-in
// users authenticate via their Google ID token, never a password). Atomic via
// ON CONFLICT so two concurrent first-time sign-ins can't race to insert twice.
export async function findOrCreateGoogleUser(
  email: string,
  name: string,
): Promise<User> {
  const { rows } = await query<UserRow>(
    `insert into users (email, name)
     values ($1, $2)
     on conflict (email) do update set email = excluded.email
     returning id, email, name, password_hash, is_pro, stripe_customer_id, stripe_subscription_id`,
    [email.toLowerCase(), name],
  );
  return rowToUser(rows[0]!);
}

export async function findUserByEmail(
  email: string,
): Promise<(User & { passwordHash: string }) | null> {
  const { rows } = await query<UserRow>(
    `select id, email, name, password_hash, is_pro, stripe_customer_id, stripe_subscription_id from users where email = $1`,
    [email.toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: row.password_hash };
}

export async function updateUserPassword(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await query(`update users set password_hash = $2 where id = $1`, [
    userId,
    passwordHash,
  ]);
  try {
    await getRedis().del(userCacheKey(userId));
  } catch {
    // best-effort cache invalidation; the cache only holds public identity
    // fields (id/email/name), not the password, so a stale entry is harmless.
  }
}

/** Upgrade or downgrade a user's Pro status and update Stripe fields. */
export async function setUserProStatus(
  userId: string,
  isPro: boolean,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  await query(
    `update users
     set is_pro = $2,
         stripe_customer_id = coalesce($3, stripe_customer_id),
         stripe_subscription_id = coalesce($4, stripe_subscription_id)
     where id = $1`,
    [userId, isPro, stripeCustomerId ?? null, stripeSubscriptionId ?? null],
  );
  // Invalidate cached user so next request reads fresh data
  try {
    await getRedis().del(userCacheKey(userId));
  } catch {
    // best-effort
  }
}

/** Find a user by their Stripe customer ID (used in webhook fulfillment). */
export async function findUserByStripeCustomerId(
  customerId: string,
): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `select id, email, name, password_hash, is_pro, stripe_customer_id, stripe_subscription_id
     from users where stripe_customer_id = $1`,
    [customerId],
  );
  const row = rows[0];
  if (!row) return null;
  return rowToUser(row);
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
    `select id, email, name, password_hash, is_pro, stripe_customer_id, stripe_subscription_id from users where id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null; // don't cache negative lookups
  const user = rowToUser(row);

  try {
    await getRedis().set(key, JSON.stringify(user), "EX", USER_CACHE_TTL_SEC);
  } catch {
    // cache write is best-effort
  }

  return user;
}
