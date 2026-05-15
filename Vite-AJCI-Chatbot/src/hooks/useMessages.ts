import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../lib/api";
import type { Message, Session } from "../lib/types";

function uid(prefix = "tmp"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useMessages(sessionId: string | undefined) {
  return useQuery<Message[]>({
    queryKey: ["messages", sessionId],
    queryFn: () => api.sessions.messages(sessionId!),
    enabled: !!sessionId,
  });
}

export function useSendMessage(sessionId: string | undefined) {
  const qc = useQueryClient();

  const updateMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      if (!sessionId) return;
      qc.setQueryData<Message[]>(["messages", sessionId], (prev) => updater(prev ?? []));
    },
    [qc, sessionId],
  );

  return useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) throw new Error("No session selected");

      const userMsg: Message = {
        id: uid("usr"),
        sessionId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      const assistantId = uid("ast");
      const assistantMsg: Message = {
        id: assistantId,
        sessionId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      };

      updateMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        for await (const token of api.streamChat(sessionId, content)) {
          updateMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
          );
        }
        updateMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
        );
      } catch (err) {
        updateMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, pending: false, content: m.content || "[stream failed]" }
              : m,
          ),
        );
        throw err;
      }

      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onSuccess: () => {
      qc.setQueryData<Session[]>(["sessions"], (prev) => prev);
    },
  });
}
