import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { getRedis } from "./redis.js";

// One-time codes, stored in Redis only (never the DB). The code itself is never
// persisted — only its SHA-256 hash — so a leaked Redis dump can't reveal a live
// code. A short TTL plus an attempt cap are the real brute-force defense.
//
// Keyed by purpose so the password-reset and Google-login flows can't collide.
// A purpose may stash a small payload (e.g. the verified Google name) that is
// returned on a successful verify — this lets a flow hold server-trusted data
// between "send code" and "verify code" without trusting the client to resend it.
const OTP_TTL_SEC = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

export type OtpPurpose = "pwreset" | "login";

const otpKey = (purpose: OtpPurpose, email: string) =>
  `otp:${purpose}:${email.toLowerCase()}`;

interface OtpRecord {
  hash: string;
  attempts: number;
  payload?: Record<string, string>;
}

export function generateOtp(): string {
  // randomInt is cryptographically unbiased, unlike Math.random.
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Constant-time compare of two hex digests of equal length.
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function storeOtp(
  purpose: OtpPurpose,
  email: string,
  code: string,
  payload?: Record<string, string>,
): Promise<void> {
  const record: OtpRecord = { hash: hashOtp(code), attempts: 0 };
  if (payload) record.payload = payload;
  await getRedis().set(
    otpKey(purpose, email),
    JSON.stringify(record),
    "EX",
    OTP_TTL_SEC,
  );
}

export type VerifyResult = "ok" | "invalid" | "expired" | "locked";

export interface VerifyOutcome {
  result: VerifyResult;
  payload?: Record<string, string>;
}

export async function verifyOtp(
  purpose: OtpPurpose,
  email: string,
  code: string,
): Promise<VerifyOutcome> {
  const redis = getRedis();
  const key = otpKey(purpose, email);

  const raw = await redis.get(key);
  if (!raw) return { result: "expired" };

  let record: OtpRecord;
  try {
    record = JSON.parse(raw) as OtpRecord;
  } catch {
    await redis.del(key);
    return { result: "expired" };
  }

  if (hashesEqual(record.hash, hashOtp(code))) {
    await redis.del(key);
    return { result: "ok", payload: record.payload };
  }

  const attempts = record.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    return { result: "locked" };
  }

  // Persist the incremented attempt count without resetting the expiry.
  await redis.set(key, JSON.stringify({ ...record, attempts }), "KEEPTTL");
  return { result: "invalid" };
}
