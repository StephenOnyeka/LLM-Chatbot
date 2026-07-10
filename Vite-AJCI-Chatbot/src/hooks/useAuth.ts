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

// Step 1: hand Google's ID token to the backend, which directly signs in the
// user and returns their profile + JWT.
export function useStartGoogleLogin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (credential: string) => api.auth.startGoogleLogin(credential),
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      navigate("/chat", { replace: true });
    },
  });
}

// Kept for potential future use (e.g. email OTP flows), but Google sign-in
// no longer requires a verify step.
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

export function useCancelPro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.stripe.cancelSubscription(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
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
