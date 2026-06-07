# Caching in AJCI Chatbot

This document describes how caching works across the project. The repo is split
into two separately deployed apps — `Vite-AJCI-Chatbot/` (frontend, Vercel) and
`ajci-backend/` (backend, Render) — and they cache independently. There is **no
shared cache** between them; they communicate only over the HTTP API.

There are four caching layers in total: three on the backend (all in Redis) and
one on the frontend (React Query). A fifth, static-asset caching, is handled by
Vercel/Vite defaults and needs no project code.

---

## At a glance

| # | Layer | Where | Store | Key | TTL | Invalidation |
|---|-------|-------|-------|-----|-----|--------------|
| 1 | LLM response cache | `ajci-backend/src/lib/responseCache.ts` | Redis | `resp:<sha256(userId, model, history)>` | 24h | TTL only |
| 2 | Auth/user cache | `ajci-backend/src/repos/users.ts` | Redis | `user:<id>` | 5 min | TTL only (users never change) |
| 3 | History cache | `ajci-backend/src/repos/messages.ts` | Redis | `chat:history:<conversationId>` | 30 min | on append + on conversation delete |
| 4 | Server-state cache | `Vite-AJCI-Chatbot/src/main.tsx` + hooks | React Query (memory) | `["messages", id]`, `["sessions"]` | `staleTime` 5 min / `gcTime` 30 min | `invalidateQueries` after send |
| 5 | Static assets | `vercel.json` + Vite build | Vercel CDN | content-hashed filenames | immutable | new hash on rebuild |

All Redis access goes through a single shared client from
`ajci-backend/src/lib/redis.ts` (`getRedis()`). BullMQ uses its own separate
connection via `bullmqConnectionOptions()`.

---

## Design principles

1. **Fail open.** Every backend cache read/write is wrapped in `try/catch` and
   degrades to a direct Postgres read on any Redis error. A Redis outage slows
   things slightly but never returns an error. See "Fail-open behavior" below.
2. **Cache-aside (lazy).** Read Redis first; on a miss, read the DB and populate
   Redis; return. Nothing is pre-warmed.
3. **Invalidate on write, don't update in place.** When the underlying data
   changes, the relevant key is `DEL`eted so the next read repopulates it.
4. **TTL everything.** No entry lives forever; every key has an expiry.
5. **Per-user isolation.** Any cache holding user-specific content includes the
   user id in its key so one user's data can never be served to another.

---

## 1. LLM response cache (Redis)

**Files:** `ajci-backend/src/lib/responseCache.ts`, wired into
`ajci-backend/src/routes/chat.ts`.

Memoizes the model's reply so an identical prompt doesn't re-hit Gemini.

- **Key:** `resp:<sha256>` where the hash is over a canonical JSON of
  `{ userId, model, history }` (`hashPromptKey`). The history is projected to
  `{ role, parts:[{text}] }` so future additions to `GeminiTurn` don't
  invalidate every existing key.
- **`userId` in the key is a privacy guarantee:** two different users who send
  an identical prompt get **separate** cache entries, so one user's reply can
  never be replayed to another. (Verified live: identical prompts from two users
  produce two distinct `resp:` keys.)
- **Determinism:** generation uses `temperature: 0`
  (`ajci-backend/src/lib/gemini.ts`). This is what makes caching *sound* — a
  cached reply equals what the model would regenerate, instead of freezing one
  random sample for 24h.
- **TTL:** `RESPONSE_CACHE_TTL_SEC = 86_400` (24h).
- **Flow in `chat.ts`:**
  - On a **hit**, the cached text is replayed through the same SSE protocol in
    40-char chunks (`CACHE_REPLAY_CHUNK`) so the frontend can't tell it from a
    live stream.
  - On a **miss**, tokens stream live from Gemini and are assembled.
  - The cache is populated **only** on a successful, non-aborted, non-empty live
    generation — aborted/empty streams never poison it.

**Known limitation:** the key is the full conversation history, so after turn 1
every multi-turn conversation has a unique history and rarely hits. In practice
this behaves like a first-message/FAQ cache. This is a known trade-off, not a
bug; raising the hit rate (e.g. normalized-prompt keys) is possible future work.

---

## 2. Auth / user cache (Redis)

**File:** `ajci-backend/src/repos/users.ts` (`findUserById`).

`requireAuth` (`ajci-backend/src/middleware/auth.ts`) calls `findUserById` on
**every authenticated request**, which was a Postgres round-trip per request.
It's now cache-aside:

- **Key:** `user:<id>`, value `JSON.stringify({ id, email, name })`.
- **TTL:** `USER_CACHE_TTL_SEC = 300` (5 min).
- **Positive-only:** a missing user is **not** cached (the value is always a
  `User`, never `null`), so a not-found result is never pinned.
- **Invalidation:** none needed — users are only ever *created* in this codebase
  (no update/delete path). **If a user update/delete path is ever added, it MUST
  `DEL user:<id>`** (noted in a code comment).

`middleware/auth.ts` was not changed — caching is internal to `findUserById`.

---

## 3. Conversation history cache (Redis)

**Files:** `ajci-backend/src/repos/messages.ts` (read + invalidate on append),
`ajci-backend/src/repos/conversations.ts` (invalidate on delete).

A conversation's full message list is read by the `/messages` endpoint and,
sliced, on every chat turn. It's cached once as the single source of truth.

- **Key:** `chat:history:<conversationId>`, value is the full **oldest-first**
  `Message[]`. `createdAt` is already an ISO string, so JSON round-trips
  losslessly.
- **TTL:** `HISTORY_CACHE_TTL_SEC = 1800` (30 min).
- **Single key, derived reads** (all go through the private `getCachedMessages`):
  - `listForConversation` → returns the cached list directly (used by
    `GET /sessions/:id/messages` in `routes/sessions.ts`).
  - `listAsGeminiHistory(limit)` → `slice(-limit)` of the cached list, mapped to
    Gemini turns (`assistant → model`). Equivalent to the old
    `order by created_at desc limit N` + reverse.
  - `countForConversation` → `messages.length` of the cached list.
- **Invalidation (`DEL`, best-effort):**
  - `append` (new user or assistant message) deletes the key after insert.
  - `deleteOwned` (conversation deleted; messages cascade in PG) deletes the key.

**Chat-path note:** within a single chat request the order is
`append(user) → listAsGeminiHistory`, so the key is invalidated then
repopulated on the same request. The cache therefore mainly benefits the
`/messages` endpoint and repeat reads, not the chat turn itself. This is an
accepted trade-off.

---

## 4. Frontend server-state cache (React Query)

**Files:** `Vite-AJCI-Chatbot/src/main.tsx`, hooks in
`Vite-AJCI-Chatbot/src/hooks/`.

React Query is the client-side ("L1") cache for data fetched from the API.

- **Config (`main.tsx`):** `retry: false`, `refetchOnWindowFocus: false`,
  `staleTime: 5 min`, `gcTime: 30 min`. The `staleTime` stops the app from
  refetching `messages`/`sessions` on every component mount/navigation.
- **Keys:** `["messages", sessionId]`, `["sessions"]`.
- **Optimistic updates + invalidation (`hooks/useMessages.ts`):** sending a
  message optimistically appends to `["messages", id]`, streams tokens into the
  pending assistant message, then `invalidateQueries(["sessions"])` so the
  sidebar/session list refreshes. Explicit invalidation still works regardless
  of `staleTime`.

Think of it as: **React Query = L1 (per-browser), Redis = L2 (server-side,
cross-instance).**

---

## 5. Static assets (Vercel / Vite)

`Vite-AJCI-Chatbot/vercel.json` is only an SPA rewrite (`/(.*) → /index.html`).
Asset caching is Vite's content-hashed `dist/` filenames served immutably by
Vercel's CDN. No project code required; a rebuild produces new hashes.

---

## Fail-open behavior (Redis down)

**File:** `ajci-backend/src/lib/redis.ts` (`getRedis()`).

The shared Redis client is configured to **fail fast** so a Redis outage doesn't
hang requests:

- `maxRetriesPerRequest: 1` — a command retries at most once, then rejects into
  the cache `try/catch` (instead of the default 20 retries).
- `commandTimeout: 1000` — bounds a connected-but-stalled Redis to ~1s.
- `enableOfflineQueue: true` — tolerates brief reconnect blips.

With these, when Redis is unreachable every cache call rejects in ~1s and falls
through to Postgres. Verified live with an unreachable Redis: register, `/me`,
session create, chat (SSE), and `/messages` all succeed in ~1–2s instead of the
previous ~20s hang. The boot-time `pingRedis()` in `index.ts` is also fail-open
("continuing in degraded mode").

> BullMQ uses a **separate** connection (`bullmqConnectionOptions()` with
> `maxRetriesPerRequest: null`); the fail-fast settings above apply only to the
> general-purpose cache/rate-limit client.

---

## Related: rate limiting (Redis, not a cache)

`ajci-backend/src/middleware/rateLimit.ts` also uses the shared Redis client
(`INCR` + `EXPIRE … NX` in one `multi()`), keyed `rl:<bucket>:<ip>`. It's not a
cache but shares the same fail-open guarantee (a Redis error calls `next()` and
lets the request through).

---

## How to verify

With the backend running and `REDIS_URL` reachable:

- **Auth cache:** make any authenticated request, then check Redis for a
  `user:<id>` key with a TTL ≤ 300s.
- **History cache:** open a conversation's `/messages` → a
  `chat:history:<id>` key appears (TTL ≤ 1800s). Send a message → the key is
  deleted; read again → it repopulates. Delete the conversation → key gone.
- **LLM cache / isolation:** two different users send the *same* first message →
  two **separate** `resp:` keys (no collision).
- **Fail-open:** point a backend instance at an unreachable `REDIS_URL`; all
  endpoints still respond (degrade to DB) within ~1–2s.
- **React Query:** navigate between sessions within 5 min → no refetch in the
  Network tab; sending a message still refreshes the session list.
