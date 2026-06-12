import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type {
  Credentials,
  RegisterPayload,
  ResetPasswordPayload,
  User,
} from "../lib/types";

const ME_KEY = ["auth", "me"] as const;

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
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      navigate("/chat", { replace: true });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => api.auth.register(payload),
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      navigate("/chat", { replace: true });
    },
  });
}

// Step 1: send the Google ID token, get a code emailed, then go to the verify
// page carrying the email it was sent to.
export function useStartGoogleLogin() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (credential: string) => api.auth.startGoogleLogin(credential),
    onSuccess: ({ email }) => {
      navigate("/google-verify", { state: { email } });
    },
  });
}

// Step 2: verify the emailed code and log in.
export function useVerifyGoogleLogin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      api.auth.verifyGoogleLogin(email, code),
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      navigate("/chat", { replace: true });
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
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      navigate("/chat", { replace: true });
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
