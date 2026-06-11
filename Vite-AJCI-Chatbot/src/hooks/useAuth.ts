import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type NavigateFunction, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type {
  Credentials,
  RegisterPayload,
  ResetPasswordPayload,
  Session,
  User,
} from "../lib/types";

const ME_KEY = ["auth", "me"] as const;

// After auth, drop the user straight into a fresh chat so they can type right
// away. If creating the session fails, fall back to /chat so login never
// dead-ends.
async function enterFreshChat(qc: QueryClient, navigate: NavigateFunction): Promise<void> {
  try {
    const session = await api.sessions.create();
    qc.setQueryData<Session[]>(["sessions"], (prev) => [session, ...(prev ?? [])]);
    // The optimistic setQueryData above marks the list "fresh", which (with the
    // global 5-min staleTime) would stop the sidebar from refetching on mount —
    // hiding the user's real history behind just this new session. Invalidate so
    // the sidebar pulls the authoritative full list (which includes this session)
    // from the server.
    void qc.invalidateQueries({ queryKey: ["sessions"] });
    navigate(`/chat/${session.id}`, { replace: true });
  } catch {
    navigate("/chat", { replace: true });
  }
}

export function useAuth() {
  return useQuery<User | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (creds: Credentials) => api.auth.login(creds),
    onSuccess: async (user) => {
      qc.setQueryData(ME_KEY, user);
      await enterFreshChat(qc, navigate);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => api.auth.register(payload),
    onSuccess: async (user) => {
      qc.setQueryData(ME_KEY, user);
      await enterFreshChat(qc, navigate);
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.auth.forgotPassword(email),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => api.auth.resetPassword(payload),
    onSuccess: async (user) => {
      qc.setQueryData(ME_KEY, user);
      await enterFreshChat(qc, navigate);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      qc.clear();
      navigate("/login", { replace: true });
    },
  });
}
