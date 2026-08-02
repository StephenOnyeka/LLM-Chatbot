import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Session } from "../lib/types";

const KEY = ["sessions"] as const;

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: KEY,
    queryFn: api.sessions.list,
  });
}

// "New chat" no longer creates a backend session — it just navigates to the
// /chat draft. The session is created lazily when the user sends the first
// message (see DraftChat). This keeps empty "New chat" rows out of history.
export function useNewChat() {
  const navigate = useNavigate();
  return useCallback(() => {
    navigate("/chat");
  }, [navigate]);
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
