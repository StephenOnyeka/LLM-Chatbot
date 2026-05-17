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

## 5. API surface

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

## 6. Production build

```bash
npm run build
npm start
```

`tsc` emits to `dist/`. Set `NODE_ENV=production` in the deployment environment so cookies pick up the `Secure` flag.

## 7. Redis

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

## 8. Pairing with the Vite frontend

The frontend (`../Vite-AJCI-Chatbot`) proxies `/api → http://localhost:4000` in dev (see `vite.config.ts`), so cookies share the `localhost:5173` origin. To switch the frontend off the in-memory mock and onto this backend, replace the mock imports in `Vite-AJCI-Chatbot/src/lib/api/index.ts` with `fetch` calls through `client.ts` (see plan, Phase 3).
