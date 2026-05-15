import { ApiError, request } from "./client";
import type {
  Credentials,
  Message,
  RegisterPayload,
  Session,
  User,
} from "../types";

async function* streamChat(
  sessionId: string,
  content: string,
): AsyncIterable<string> {
  const base = import.meta.env.VITE_API_BASE ?? "/api";
  const res = await fetch(`${base}/sessions/${sessionId}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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
    login: (creds: Credentials) =>
      request<User>("/auth/login", { method: "POST", body: JSON.stringify(creds) }),
    register: (payload: RegisterPayload) =>
      request<User>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
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
