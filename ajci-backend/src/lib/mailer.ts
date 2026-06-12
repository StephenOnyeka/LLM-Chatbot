import { Resend } from "resend";
import { env } from "../config.js";

// Single lazily-constructed Resend client, mirroring the redis singleton.
let client: Resend | null = null;

function getResend(): Resend {
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

const OTP_TTL_MINUTES = 10;

async function sendCodeEmail(
  to: string,
  subject: string,
  heading: string,
  intro: string,
  code: string,
  ignoreNote: string,
): Promise<void> {
  const { error } = await getResend().emails.send({
    from: env.RESEND_FROM,
    to,
    subject,
    text: `Your code is ${code}. It is valid for ${OTP_TTL_MINUTES} minutes. ${ignoreNote}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 8px;">${heading}</h2>
        <p style="color: #555; margin: 0 0 20px;">${intro}</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f4f4f5; border-radius: 12px;">
          ${code}
        </div>
        <p style="color: #888; font-size: 13px; margin: 20px 0 0;">
          This code expires in ${OTP_TTL_MINUTES} minutes. ${ignoreNote}
        </p>
      </div>
    `,
  });

  // The Resend SDK returns errors in the response rather than throwing, so
  // surface them so the route can map to a 502 and the user can retry.
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }
}

export function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  return sendCodeEmail(
    to,
    "Your AJCI Chat password reset code",
    "Reset your password",
    "Use the code below to reset your AJCI Chat password.",
    code,
    "If you didn't request a password reset, you can safely ignore this email.",
  );
}

export function sendLoginCodeEmail(to: string, code: string): Promise<void> {
  return sendCodeEmail(
    to,
    "Your AJCI Chat sign-in code",
    "Confirm your sign-in",
    "Use the code below to finish signing in to AJCI Chat.",
    code,
    "If you didn't try to sign in, you can safely ignore this email.",
  );
}
