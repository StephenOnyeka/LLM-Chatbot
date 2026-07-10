import { HttpError } from "../middlewares/error.middleware.js";
import { verifyGoogleIdToken } from "../utils/google.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { generateOtp, storeOtp, verifyOtp } from "../utils/otp.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  createUser,
  findOrCreateGoogleUser,
  findUserByEmail,
  updateUserPassword,
} from "../repositories/user.repository.js";
import { z } from "zod";
import {
  RegisterBody,
  LoginBody,
  GoogleBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../validators/auth.validator.js";

export async function registerUser(body: z.infer<typeof RegisterBody>) {
  const existing = await findUserByEmail(body.email);
  if (existing) throw new HttpError(409, "Email already registered");

  const passwordHash = await hashPassword(body.password);
  const user = await createUser(body.email, body.name, passwordHash);
  return user;
}

export async function loginUser(body: z.infer<typeof LoginBody>) {
  const found = await findUserByEmail(body.email);
  if (!found) throw new HttpError(401, "Invalid email or password");

  const ok = await verifyPassword(body.password, found.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid email or password");

  return { id: found.id, email: found.email, name: found.name };
}

export async function googleSignIn(body: z.infer<typeof GoogleBody>) {
  let profile;
  try {
    profile = await verifyGoogleIdToken(body.credential);
  } catch {
    throw new HttpError(401, "Google sign-in failed. Please try again.");
  }

  const user = await findOrCreateGoogleUser(profile.email, profile.name);
  return user;
}

export async function processForgotPassword(body: z.infer<typeof ForgotPasswordBody>) {
  const user = await findUserByEmail(body.email);

  if (user) {
    const code = generateOtp();
    await storeOtp("pwreset", body.email, code);
    try {
      await sendPasswordResetEmail(body.email, code);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw new HttpError(502, "Failed to send the reset email. Try again.");
    }
  }
}

export async function processResetPassword(body: z.infer<typeof ResetPasswordBody>) {
  const { result } = await verifyOtp("pwreset", body.email, body.code);
  if (result === "expired") {
    throw new HttpError(400, "Code expired or not found. Request a new one.");
  }
  if (result === "locked") {
    throw new HttpError(429, "Too many attempts. Request a new code.");
  }
  if (result === "invalid") {
    throw new HttpError(400, "Invalid code.");
  }

  const found = await findUserByEmail(body.email);
  if (!found) throw new HttpError(400, "Code expired or not found. Request a new one.");

  const passwordHash = await hashPassword(body.password);
  await updateUserPassword(found.id, passwordHash);

  return { id: found.id, email: found.email, name: found.name };
}
