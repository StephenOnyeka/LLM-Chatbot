import { z } from "zod";

export const RegisterBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(80),
});

export const LoginBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const GoogleBody = z.object({
  credential: z.string().min(1),
});

export const GoogleVerifyBody = z.object({
  email: z.string().email().max(254),
  code: z.string().length(6),
});

export const ForgotPasswordBody = z.object({
  email: z.string().email().max(254),
});

export const ResetPasswordBody = z.object({
  email: z.string().email().max(254),
  code: z.string().length(6),
  password: z.string().min(6).max(128),
});
