import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Message, Session } from "../lib/types";

const KEY = ["sessions"] as const;

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: KEY,
    queryFn: api.sessions.list,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const mutation = useMutation({
    mutationFn: () => api.sessions.create(),
    onSuccess: (session) => {
      qc.setQueryData<Session[]>(KEY, (prev) => [session, ...(prev ?? [])]);
      navigate(`/chat/${session.id}`);
    },
  });

  // If the chat already open has no messages, "New chat" is a no-op — stay on
  // it instead of spawning another empty session. We only suppress when the
  // messages are known-empty (cached as []); an unknown/undefined cache allows
  // creation so a genuine new chat is never blocked.
  const create = useCallback(() => {
    if (sessionId) {
      const cached = qc.getQueryData<Message[]>(["messages", sessionId]);
      if (cached && cached.length === 0) return;
    }
    mutation.mutate();
  }, [sessionId, qc, mutation]);

  return { ...mutation, mutate: create };
}

export function useDeleteSession() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => api.sessions.remove(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<Session[]>(KEY, (prev) => (prev ?? []).filter((s) => s.id !== id));
      qc.removeQueries({ queryKey: ["messages", id] });
      navigate("/chat", { replace: true });
    },
  });
}
