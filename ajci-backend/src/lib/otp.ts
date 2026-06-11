import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { getRedis } from "./redis.js";

// Password-reset OTP, stored in Redis only (never the DB). The code itself is
// never persisted — only its SHA-256 hash — so a leaked Redis dump can't reveal
// a live code. A short TTL plus an attempt cap are the real brute-force defense.
const OTP_TTL_SEC = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

const otpKey = (email: string) => `otp:pwreset:${email.toLowerCase()}`;

interface OtpRecord {
  hash: string;
  attempts: number;
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

export async function storeOtp(email: string, code: string): Promise<void> {
  const record: OtpRecord = { hash: hashOtp(code), attempts: 0 };
  await getRedis().set(otpKey(email), JSON.stringify(record), "EX", OTP_TTL_SEC);
}

export type VerifyResult = "ok" | "invalid" | "expired" | "locked";

export async function verifyOtp(
  email: string,
  code: string,
): Promise<VerifyResult> {
  const redis = getRedis();
  const key = otpKey(email);

  const raw = await redis.get(key);
  if (!raw) return "expired";

  let record: OtpRecord;
  try {
    record = JSON.parse(raw) as OtpRecord;
  } catch {
    await redis.del(key);
    return "expired";
  }

  if (hashesEqual(record.hash, hashOtp(code))) {
    await redis.del(key);
    return "ok";
  }

  const attempts = record.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    return "locked";
  }

  // Persist the incremented attempt count without resetting the expiry.
  await redis.set(
    key,
    JSON.stringify({ ...record, attempts }),
    "KEEPTTL",
  );
  return "invalid";
}
