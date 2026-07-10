// Pure email HTML builders — no env/SDK imports, so they can be rendered in a
// browser preview (see scripts/previewEmails.ts) and stay in sync with what
// mailer.ts actually sends.

// Email feature icons are static PNGs served from the frontend's public/email/
// folder. Email clients render hosted <img> PNGs everywhere (Gmail/Outlook strip
// inline SVG), so we reference them by filename. The names map to the files in
// Vite-AJCI-Chatbot/public/email/.
type EmailIconName = "cloudUpload" | "visibility" | "rocketLaunch";

// Default absolute base URL for the hosted icon PNGs. Must be a public https URL
// since emails are opened outside our app — defaults to the deployed frontend
// and can be overridden with EMAIL_ASSET_BASE_URL (e.g. a staging domain), or
// per-call via the assetBase argument (the preview script points it at the
// local public/email folder so icons show before deploying).
const DEFAULT_ASSET_BASE = (
  process.env.EMAIL_ASSET_BASE_URL ?? "https://ajci-chatbot.vercel.app"
).replace(/\/+$/, "");

function iconUrl(name: EmailIconName, assetBase: string): string {
  return `${assetBase.replace(/\/+$/, "")}/email/${name}.png`;
}

// Builds an email-safe feature row: a hosted-PNG icon beside a title/description,
// laid out with a table so it renders consistently across mail clients.
function proFeatureRow(
  icon: EmailIconName,
  title: string,
  description: string,
  assetBase: string,
): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px; background-color: #f5f3ff; border-radius: 8px;">
      <tr>
        <td valign="top" style="padding: 14px 0 14px 12px; width: 34px;">
          <img src="${iconUrl(icon, assetBase)}" width="22" height="22" alt="" style="display: block; border: 0; width: 22px; height: 22px;" />
        </td>
        <td style="padding: 12px 12px 12px 10px;">
          <strong style="color: #4f46e5; font-size: 15px;">${title}</strong>
          <span style="color: #6b7280; font-size: 13px; display: block; margin-top: 4px; line-height: 1.4;">
            ${description}
          </span>
        </td>
      </tr>
    </table>`;
}

export function proUpgradeEmailHtml(
  userName: string,
  frontendUrl: string,
  assetBase: string = DEFAULT_ASSET_BASE,
): string {
  return `
      <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #f9fafb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">AJCI Pro Plan</h1>
            <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 14px;">Your premium upgrade is active!</p>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">Welcome to Pro, ${userName}!</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              We're thrilled to have you on the <strong>AJCI Pro Plan</strong>. Your subscription is now active, and your account has been upgraded. You now have full access to our premium suite of tools:
            </p>

            <div style="margin-bottom: 24px;">
              ${proFeatureRow(
                "cloudUpload",
                "Unlimited Uploads",
                "Upload images, PDFs, word documents, and spreadsheets directly into the chat interface.",
                assetBase,
              )}
              ${proFeatureRow(
                "visibility",
                "Advanced Vision Analysis",
                "Our advanced AI reads, scans, and analyzes all visual documents and attachments you send.",
                assetBase,
              )}
              ${proFeatureRow(
                "rocketLaunch",
                "Priority Speed & Higher Limits",
                "Get faster AI responses and increased rate limits to keep chatting without interruption.",
                assetBase,
              )}
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
    `;
}

export function proCancelEmailHtml(userName: string, frontendUrl: string): string {
  return `
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
    `;
}
