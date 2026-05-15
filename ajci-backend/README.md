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

## 7. Pairing with the Vite frontend

The frontend (`../Vite-AJCI-Chatbot`) proxies `/api → http://localhost:4000` in dev (see `vite.config.ts`), so cookies share the `localhost:5173` origin. To switch the frontend off the in-memory mock and onto this backend, replace the mock imports in `Vite-AJCI-Chatbot/src/lib/api/index.ts` with `fetch` calls through `client.ts` (see plan, Phase 3).
