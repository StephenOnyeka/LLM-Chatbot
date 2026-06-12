import { ApiError, authHeaders, clearToken, request, setToken } from "./client";
import type {
  AuthResponse,
  Credentials,
  Message,
  RegisterPayload,
  ResetPasswordPayload,
  Session,
  User,
} from "../types";

async function* streamChat(
  sessionId: string,
  content: string,
): AsyncIterable<string> {
  const base = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/+$/, "");
  const res = await fetch(`${base}/sessions/${sessionId}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || res.statusText);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of event.split("\n")) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
        }

        if (dataLines.length === 0) continue;
        const payload = dataLines.join("\n");

        if (eventName === "error") {
          let message = "Stream failed";
          try {
            message = (JSON.parse(payload) as { message?: string }).message ?? message;
          } catch {
            // payload wasn't JSON — keep default
          }
          throw new ApiError(500, message);
        }

        if (payload === "[DONE]") return;

        try {
          const { token } = JSON.parse(payload) as { token: string };
          if (token) yield token;
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const api = {
  auth: {
    login: async (creds: Credentials): Promise<User> => {
      const { token, ...user } = await request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(creds),
      });
      setToken(token);
      return user;
    },
    register: async (payload: RegisterPayload): Promise<User> => {
      const { token, ...user } = await request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setToken(token);
      return user;
    },
    // Step 1: hand Google's ID token to the backend, which emails a 6-digit
    // code and returns the email to verify against.
    startGoogleLogin: (credential: string): Promise<{ email: string }> =>
      request<{ email: string }>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      }),
    // Step 2: submit the emailed code to finish signing in.
    verifyGoogleLogin: async (email: string, code: string): Promise<User> => {
      const { token, ...user } = await request<AuthResponse>(
        "/auth/google/verify",
        {
          method: "POST",
          body: JSON.stringify({ email, code }),
        },
      );
      setToken(token);
      return user;
    },
    forgotPassword: (email: string): Promise<{ ok: boolean }> =>
      request<{ ok: boolean }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: async (payload: ResetPasswordPayload): Promise<User> => {
      const { token, ...user } = await request<AuthResponse>(
        "/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setToken(token);
      return user;
    },
    logout: async (): Promise<void> => {
      try {
        await request<void>("/auth/logout", { method: "POST" });
      } finally {
        // Clear the local token even if the network call fails, so the user
        // is logged out client-side regardless.
        clearToken();
      }
    },
    me: () => request<User>("/auth/me"),
  },
  sessions: {
    list: () => request<Session[]>("/sessions"),
    create: (title?: string) =>
      request<Session>("/sessions", {
        method: "POST",
        body: JSON.stringify(title ? { title } : {}),
      }),
    remove: (id: string) =>
      request<void>(`/sessions/${id}`, { method: "DELETE" }),
    messages: (sessionId: string) =>
      request<Message[]>(`/sessions/${sessionId}/messages`),
  },
  streamChat,
};

export type Api = typeof api;
