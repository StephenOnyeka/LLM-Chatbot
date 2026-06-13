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

export async function sendProUpgradeEmail(to: string, userName: string): Promise<void> {
  const frontendUrl = env.CORS_ORIGIN[0] ?? "http://localhost:5173";
  const { error } = await getResend().emails.send({
    from: env.RESEND_FROM,
    to,
    subject: "✨ Welcome to AJCI Chat Pro Plan!",
    text: `Hi ${userName}, welcome to AJCI Chat Pro! Your subscription is active. Enjoy unlimited file/image uploads, Gemini 2.5 Flash Vision, and priority speeds. Open chat at ${frontendUrl}/chat`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #f9fafb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">AJCI Pro Plan</h1>
            <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 14px;">Your premium upgrade is active!</p>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">Welcome to Pro, ${userName}!</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              We're thrilled to have you on the **AJCI Pro Plan**. Your subscription is now active, and your account has been upgraded. You now have full access to our premium suite of tools:
            </p>
            
            <div style="margin-bottom: 24px;">
              <div style="margin-bottom: 16px; padding: 12px; background-color: #f5f3ff; border-radius: 8px;">
                <strong style="color: #4f46e5; font-size: 15px;">✨ Unlimited Uploads</strong>
                <span style="color: #6b7280; font-size: 13px; display: block; margin-top: 4px; line-height: 1.4;">
                  Upload images, PDFs, word documents, and spreadsheets directly into the chat interface.
                </span>
              </div>
              
              <div style="margin-bottom: 16px; padding: 12px; background-color: #f5f3ff; border-radius: 8px;">
                <strong style="color: #4f46e5; font-size: 15px;">👁️ Gemini 2.5 Flash Vision</strong>
                <span style="color: #6b7280; font-size: 13px; display: block; margin-top: 4px; line-height: 1.4;">
                  Our advanced AI reads, scans, and analyzes all visual documents and attachments you send.
                </span>
              </div>
              
              <div style="margin-bottom: 16px; padding: 12px; background-color: #f5f3ff; border-radius: 8px;">
                <strong style="color: #4f46e5; font-size: 15px;">🚀 Priority Speed & Higher Limits</strong>
                <span style="color: #6b7280; font-size: 13px; display: block; margin-top: 4px; line-height: 1.4;">
                  Get faster AI responses and increased rate limits to keep chatting without interruption.
                </span>
              </div>
            </div>
            
            <div style="text-align: center; margin: 32px 0 24px 0;">
              <a href="${frontendUrl}/chat" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06);">
                Open Chat Interface
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            
            <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
              You will be billed monthly. If you ever need to manage your subscription, download receipts, or cancel, please check your Stripe Customer Portal or contact support.
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }
}

export async function sendProCancelEmail(to: string, userName: string): Promise<void> {
  const frontendUrl = env.CORS_ORIGIN[0] ?? "http://localhost:5173";
  const { error } = await getResend().emails.send({
    from: env.RESEND_FROM,
    to,
    subject: "Your AJCI Chat Pro Plan has been cancelled",
    text: `Hi ${userName}, your AJCI Chat Pro subscription has been cancelled and your account has been returned to the Free plan. You can re-subscribe anytime at ${frontendUrl}/chat. Thanks for trying Pro!`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #f9fafb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
          <div style="background: linear-gradient(135deg, #475569 0%, #334155 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Subscription Cancelled</h1>
            <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Your AJCI Pro Plan has ended</p>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">Sorry to see you go, ${userName}.</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Your AJCI Chat Pro subscription has been cancelled and your account has been returned to the <strong>Free plan</strong>. You'll no longer be billed, and Pro features such as file &amp; image uploads are now disabled.
            </p>

            <div style="margin-bottom: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9;">
              <span style="color: #475569; font-size: 14px; line-height: 1.5; display: block;">
                Changed your mind? You can re-subscribe at any time and instantly restore unlimited uploads, vision analysis, and priority speeds.
              </span>
            </div>

            <div style="text-align: center; margin: 32px 0 24px 0;">
              <a href="${frontendUrl}/chat" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06);">
                Re-subscribe to Pro
              </a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

            <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
              If you didn't request this cancellation or believe it was made in error, please contact support.
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }
}

