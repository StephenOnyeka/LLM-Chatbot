import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_DOMAIN: z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  // When the frontend is on a different origin than the API (e.g. Vercel + Render),
  // the auth cookie must be SameSite=None; Secure or the browser drops it.
  COOKIE_CROSS_SITE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  // Comma-separated list of allowed origins (e.g. "http://localhost:5173,https://app.vercel.app").
  // Trailing slashes are stripped and duplicates removed so values like
  // "https://app.vercel.app/" still match the browser's Origin header.
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,https://ajci-chatbot.vercel.app")
    .transform((v) =>
      Array.from(
        new Set(
          v
            .split(",")
            .map((s) => s.trim().replace(/\/+$/, ""))
            .filter(Boolean),
        ),
      ),
    ),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  // Sandbox sender (onboarding@resend.dev) only delivers to the Resend account
  // owner's address. Swap for a verified-domain sender to email real users.
  RESEND_FROM: z.string().default("AJCI Chat <onboarding@resend.dev>"),
  // REDIS_URL: z.string().url().default("redis://localhost:6379"),
  REDIS_URL: z.string().url().default("redis://default:4UBAIHKcP5n0crPCYJM8ygOmPiGhpvZA@candied-likely-idea-98521.db.redis.io:10222"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_CHAT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
