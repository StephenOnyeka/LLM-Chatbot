# AJCI Chatbot — Frontend

The web client for the AJCI chatbot: a chat UI built with **React 19
+ TypeScript + Vite**, styled with **Tailwind CSS v4**. It talks to the
`ajci-backend` service over a small typed `fetch` client and streams assistant
replies token-by-token over Server-Sent Events (SSE).

> The backend lives in the sibling `../ajci-backend` folder and is deployed
> separately. This app only communicates with it over the HTTP API.

## 1. Prereqs

- Node 20+
- The backend running locally on `http://localhost:4000` (see `../ajci-backend/README.md`)
- A Google OAuth Web client ID (same value the backend uses for `GOOGLE_CLIENT_ID`)

## 2. Configure

```bash
cp .env.example .env
```

| Var | Purpose |
|---|---|
| `VITE_API_BASE` | Base URL for the API, **including** the `/api` suffix. Leave **blank** in local dev to use the Vite proxy (defaults to `/api`). In production, point at the deployed backend, e.g. `https://ajci-backend.onrender.com/api` (see `.env.production`). |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web client ID. Add your frontend origin (e.g. `http://localhost:5173`) to the client's authorized JavaScript origins. |

## 3. Run

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
```

In dev, `vite.config.ts` proxies `/api → http://localhost:4000`, so the frontend
and backend share the `localhost` origin (no CORS/cookie friction). Point the
proxy at the deployed backend by editing the commented `target` line.

Other scripts:

```bash
npm run build    # tsc -b && vite build → dist/
npm run preview  # serve the production build locally
npm run lint     # eslint
```

## 4. Authentication

Auth is **Bearer-token based**, not cookies. On login/register/Google sign-in the
backend returns a JWT; the client stores it in `localStorage` (`ajci_token`) and
sends it as an `Authorization: Bearer <jwt>` header on every request
(`src/lib/api/client.ts`). This works cross-site on every browser, unlike
third-party cookies. Requests also send `credentials: "include"` so a same-site
cookie still works as a fallback in local dev.

- `useAuth()` fetches `/auth/me` and is the source of truth for the current user.
- `RequireAuth` (`src/routes/RequireAuth.tsx`) guards the `/chat` routes.
- `logout` clears the token locally even if the network call fails.

## 5. Project structure

```
src/
├── main.tsx              # React root: QueryClient, Router, GoogleOAuthProvider
├── App.tsx               # Route table (public auth pages + guarded /chat)
├── routes/
│   ├── ChatPage.tsx      # /chat layout (sidebar + outlet)
│   ├── DraftChat.tsx     # /chat index — draft; creates a session on first send
│   ├── ChatThread.tsx    # /chat/:sessionId — message thread + composer
│   ├── RequireAuth.tsx   # auth gate for /chat/*
│   ├── LoginPage / RegisterPage / ForgotPasswordPage / GoogleVerifyPage
├── hooks/
│   ├── useAuth.ts        # me / login / register / google / reset / logout / cancel-pro
│   ├── useSessions.ts    # session list, new-chat nav, delete
│   └── useMessages.ts    # message list + optimistic streaming send
├── lib/
│   ├── api/client.ts     # fetch wrapper, token store, ApiError
│   ├── api/index.ts      # typed `api` object + SSE streamChat generator
│   └── types.ts          # shared DTOs (User, Session, Message, Attachment…)
├── store/uiStore.ts      # Zustand: sidebar + global alert/confirm modal
└── components/           # auth/, chat/, ui/ presentational components
```

## 6. How chat works

1. `/chat` (`DraftChat`) shows a composer but creates **no** backend session —
   this keeps empty "New chat" rows out of history.
2. On the first send it lazily `POST /api/sessions`, seeds the React Query cache,
   and navigates to `/chat/:sessionId` with the pending message in router state.
3. `useSendMessage` optimistically appends the user message + an empty pending
   assistant message, then consumes `api.streamChat(...)`.
4. `streamChat` (`src/lib/api/index.ts`) `fetch`es the chat endpoint, parses the
   SSE frames (`data: {"token":"…"}`, terminated by `data: [DONE]`, plus an
   `event: error` channel), and yields tokens as they arrive. Each token is
   appended to the pending message so the UI types out live.
5. When the stream ends, the session list is invalidated so the sidebar reflects
   the new title/order (the backend auto-titles a conversation from its first
   message).

## 7. Server-state caching (React Query)

React Query is the client-side ("L1") cache for API data. It's configured in
`main.tsx` with `staleTime: 5 min` and `gcTime: 30 min`, so navigating between
sessions doesn't refetch on every mount. Query keys: `["auth","me"]`,
`["sessions"]`, `["messages", sessionId]`. Mutations update the cache optimistically
and/or `invalidateQueries` to refetch. See the repo-root `cache.md` for how this
layer relates to the backend's Redis and HTTP caches.

## 8. Pro plan & uploads

File/image uploads require the **Pro plan**. Non-Pro users get an `UpgradeModal`
that starts a Stripe Checkout session (`api.stripe.createCheckoutSession`); on
return, `verify-session` upgrades the account. Pro users can self-downgrade via
`cancel-subscription`. Uploads go to `POST /api/upload` (multipart) and are then
referenced by URL as message attachments.

## 9. Deployment (Vercel)

`vercel.json` is a single SPA rewrite (`/(.*) → /index.html`) so client-side
routes resolve. Set `VITE_API_BASE` and `VITE_GOOGLE_CLIENT_ID` as project env
vars. Vite emits content-hashed assets into `dist/`, served immutably by Vercel's
CDN.
