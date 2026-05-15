import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useCreateSession() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.sessions.create(),
    onSuccess: (session) => {
      qc.setQueryData<Session[]>(KEY, (prev) => [session, ...(prev ?? [])]);
      navigate(`/chat/${session.id}`);
    },
  });
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
