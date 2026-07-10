import { Request, Response } from "express";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";
import { signToken } from "../utils/jwt.js";
import {
  registerUser,
  loginUser,
  googleSignIn,
  processForgotPassword,
  processResetPassword,
} from "../services/auth.service.js";
import {
  RegisterBody,
  LoginBody,
  GoogleBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../validators/auth.validator.js";

export async function register(req: Request, res: Response) {
  const body = RegisterBody.parse(req.body);
  const user = await registerUser(body);

  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.status(201).json({ ...user, token });
}

export async function login(req: Request, res: Response) {
  const body = LoginBody.parse(req.body);
  const user = await loginUser(body);

  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ ...user, token });
}

export async function google(req: Request, res: Response) {
  const body = GoogleBody.parse(req.body);
  const user = await googleSignIn(body);

  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ ...user, token });
}

export async function forgotPassword(req: Request, res: Response) {
  const body = ForgotPasswordBody.parse(req.body);
  await processForgotPassword(body);
  res.json({ ok: true });
}

export async function resetPassword(req: Request, res: Response) {
  const body = ResetPasswordBody.parse(req.body);
  const user = await processResetPassword(body);

  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ ...user, token });
}

export function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json(req.user);
}
