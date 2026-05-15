import { query } from "../db.js";
import type { User } from "../types.js";

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
  const { rows } = await query<UserRow>(
    `select id, email, name, password_hash from users where id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name };
}
