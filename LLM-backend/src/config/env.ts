import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number(),
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  JWT_EXPIRES_IN: z.string(),
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
  GEMINI_MODEL: z.string().min(1, "GEMINI_MODEL is required"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  // Sandbox sender (onboarding@resend.dev) only delivers to the Resend account
  // owner's address. Swap for a verified-domain sender to email real users.
  RESEND_FROM: z.string(),
  // Public https base URL where email image assets (icon PNGs) are hosted.
  // Defaults to the deployed frontend; override for a staging/custom domain.
  EMAIL_ASSET_BASE_URL: z.string(),
  // Google OAuth client ID (Web). Used to verify the ID token the frontend
  // sends from "Continue with Google".
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  // REDIS_URL: z.string().url().default("redis://localhost:6379"),
  REDIS_URL: z.string().url(),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive(),
  RATE_LIMIT_CHAT_PER_MINUTE: z.coerce.number().int().positive(),
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive(),
  // Stripe (Pro Plan payments)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
  // Where to store uploaded files on disk (relative to project root)
  UPLOAD_DIR: z.string(),
  // Public base URL of this backend (used to generate upload URLs)
  PUBLIC_URL: z.string(),
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
