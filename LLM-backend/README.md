# ajci-backend

Express + Postgres (Supabase) + Gemini streaming backend for the AJCI chatbot.

## 1. Prereqs

- Node 20+
- A Supabase project (free tier is fine)
- A Google AI Studio API key for Gemini

## 2. Configure

```bash
cp .env.example .env
```

Fill in:

- `DATABASE_URL` — Supabase: **Project Settings → Database → Connection string → URI**. Use the **Transaction pooler** URL (port `6543`).
- `JWT_SECRET` — generate with `openssl rand -hex 32`.
- `GEMINI_API_KEY` — from <https://aistudio.google.com/apikey>.

## 3. Initialize the database

Either run:

```bash
npm run db:init
```

(requires `psql` on PATH — uses `DATABASE_URL` from your shell env)

…or open Supabase SQL Editor and paste the contents of `sql/001_init.sql`.

You should now have three tables: `users`, `conversations`, `messages`.

## 4. Run

```bash
npm install
npm run dev      # tsx watch — restarts on file changes
```

Server boots on `http://localhost:4000`. Health check: `GET /health`.

## 5. Test

API tests run with **Vitest** + **Supertest** against the real Express app
(`createApp()`), so routing, Zod validation, auth middleware, and error handling
are all exercised end-to-end. External boundaries — Postgres, Redis, Gemini,
Stripe, Google, and email — are mocked at the module level, so the suite is fast
and needs **no live infrastructure or real credentials** (`test/setup.env.ts`
supplies dummy env vars before any module loads).

```bash
npm test            # run once
npm run test:watch  # re-run on change
npm run test:coverage
```

Coverage (`test/*.test.ts`): health/docs/CORS/404, auth (register, login,
google, forgot/reset password, logout, me), sessions CRUD, chat SSE streaming
(live + cached), file upload/serve, and Stripe checkout/verify/cancel/webhook.

## 6. Architecture

The application uses a standard layered architecture:
- **`src/config/`**: Environment and database configuration.
- **`src/middlewares/`**: Express middlewares (auth, rate limiting, error handling).
- **`src/validators/`**: Zod schemas for validating request payloads.
- **`src/controllers/`**: HTTP request handlers (parses `req`, sends `res`).
- **`src/services/`**: Core business logic (orchestrates models, emails, external APIs).
- **`src/repositories/`**: Database queries and direct data access.
- **`src/utils/`**: Helper utilities (Redis, Gemini, mailer, JWT, etc.).
- **`src/routes/`**: Route definitions mapping endpoints to controllers.

## 7. API surface

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{ email, password, name }` → `User`, sets cookie |
| POST | `/api/auth/login` | — | `{ email, password }` → `User`, sets cookie |
| POST | `/api/auth/logout` | — | clears cookie, 204 |
| GET | `/api/auth/me` | cookie | returns the current `User` |
| GET | `/api/sessions` | cookie | `Session[]` newest-first |
| POST | `/api/sessions` | cookie | `{ title? }` → `Session` |
| DELETE | `/api/sessions/:id` | cookie | 204 |
| GET | `/api/sessions/:id/messages` | cookie | `Message[]` |
| POST | `/api/sessions/:id/chat` | cookie | streams `data: {"token":"..."}` SSE, terminated by `data: [DONE]` |

Auth is via the `ajci_token` httpOnly cookie. The frontend sends `credentials: 'include'`; nothing is stored in JS-accessible storage.

## 8. Production build

```bash
npm run build
npm start
```

`tsc` emits to `dist/`. Set `NODE_ENV=production` in the deployment environment so cookies pick up the `Secure` flag.

## 9. Redis

Redis is used for three things, all of which fail open — if Redis is down the app keeps serving:

- **Per-IP rate limiting** on `/api/*` (default 60/min globally; 20/min on chat; 10/min on `login`+`register` combined).
- **24-hour response cache** keyed by `SHA-256(model + conversation history)`. Identical first questions across users replay the cached reply over SSE instead of hitting Gemini.
- **BullMQ scaffolding** for future async AI jobs. The queue and worker exist but no producer is wired yet.

### Run a local Redis

```bash
docker run --name ajci-redis -p 6379:6379 -d redis:7-alpine
```

Configure via the `REDIS_URL` env var (defaults to `redis://localhost:6379`). Tunable rate-limit env vars: `RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_CHAT_PER_MINUTE`, `RATE_LIMIT_AUTH_PER_MINUTE`.

When a rate limit is exceeded, the response is `429 {"message":"Too many requests"}` with `Retry-After` and `X-RateLimit-*` headers.

### Run the BullMQ worker (separate process)

```bash
npm run worker
```

The worker connects to the same `REDIS_URL` and consumes the `ai-jobs` queue. Currently it just logs received jobs — wire producers when you have heavy/async work to push off the request path.

## 10. Pairing with the Vite frontend

The frontend (`../Vite-AJCI-Chatbot`) proxies `/api → http://localhost:4000` in dev (see `vite.config.ts`), so cookies share the `localhost:5173` origin. To switch the frontend off the in-memory mock and onto this backend, replace the mock imports in `Vite-AJCI-Chatbot/src/lib/api/index.ts` with `fetch` calls through `client.ts` (see plan, Phase 3).

## 11. Stripe & Pro Plan Integration

To support file/image uploads, users must upgrade to the **Pro Plan** through Stripe checkout.

### Env Configuration:
- `STRIPE_SECRET_KEY` — Your Stripe Test mode secret key (`sk_test_...`) or a restricted key with write access to Checkout Sessions, Customers, and Subscriptions.
- `STRIPE_PRICE_ID` *(Optional)* — If left blank, the backend automatically generates a $10/mo inline price.
- `STRIPE_WEBHOOK_SECRET` *(Optional for dev)* — Only required if you want real-time webhook sync. If blank, instant upgrade is handled automatically upon successful redirect via redirect session validation.

### Testing Payments in Test Mode:
When redirected to Stripe checkout:
* **Card Number:** `4242 4242 4242 4242`
* **Expiry Date:** Any future date (e.g., `12/30`)
* **CVC:** Any 3 digits (e.g., `123`)
* **Name & Postal Code:** Any mock values

### Plan expiry & renewal date

The subscription auto-renews monthly. On upgrade we store the current billing
period end in `users.pro_expires_at` (migration `004_pro_expiry.sql`), read from
the Stripe subscription's `current_period_end`. It's exposed on `/api/auth/me`
as `proExpiresAt` and shown in the sidebar as a "Renews on …" date. The column
is cleared to `null` whenever the user downgrades.

A user stays Pro until either:
* the `customer.subscription.deleted` webhook fires (requires
  `STRIPE_WEBHOOK_SECRET`), or
* they cancel via the endpoint below (works without webhooks).

### Cancelling / self-downgrade (for testing)

`POST /api/stripe/cancel-subscription` (authenticated) cancels the user's Stripe
subscription **immediately**, flips `is_pro` to `false`, clears `pro_expires_at`,
and emails a cancellation confirmation. From the app, Pro users get a
**Cancel Pro** button in the sidebar. To trigger it manually:

```bash
curl -X POST http://localhost:4000/api/stripe/cancel-subscription \
  -H "Authorization: Bearer <jwt>"
```

To switch to end-of-period cancellation instead of immediate, see the commented
one-line swap in `src/services/stripe.service.ts` (`cancel_at_period_end: true`).

