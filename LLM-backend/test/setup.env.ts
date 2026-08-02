// Runs before any application module is imported (vitest `setupFiles`).
//
// config/env.ts validates process.env at import time and calls process.exit(1)
// on missing required vars. These fixtures satisfy that schema with obviously
// fake values so the test suite never touches real infrastructure. Anything
// that would make a real network call (Postgres, Redis, Gemini, Stripe, Google,
// Resend) is mocked at the module boundary inside the individual test files.

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test_db";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
process.env.JWT_EXPIRES_IN = "7d";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.GEMINI_MODEL = "gemini-2.5-flash";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.RATE_LIMIT_PER_MINUTE = "1000";
process.env.RATE_LIMIT_CHAT_PER_MINUTE = "1000";
process.env.RATE_LIMIT_AUTH_PER_MINUTE = "1000";
// Stripe is optional in env.ts; leave STRIPE_* set so the "configured" paths
// are exercisable. Tests that need the "not configured" path unset them.
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
process.env.STRIPE_PRICE_ID = "price_test_fake";
process.env.PUBLIC_URL = "http://localhost:4000";
