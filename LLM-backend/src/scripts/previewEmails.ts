/**
 * Renders the Pro emails to standalone HTML files so you can preview them in a
 * browser before anything is actually sent. No env or network needed.
 *
 * Usage:  npx tsx src/scripts/previewEmails.ts
 * Output: written to ./email-previews/, then opened in your default browser.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { proCancelEmailHtml, proUpgradeEmailHtml } from "../utils/emailTemplates.js";

const SAMPLE_NAME = "Stephen";
const SAMPLE_URL = "http://localhost:5173";

// Point the icon <img> tags at the static PNGs in the frontend public folder
// via a file:// URL, so the preview shows real icons without needing the
// frontend deployed. The PNGs live in Vite-AJCI-Chatbot/public/email/.
const LOCAL_ASSET_BASE = pathToFileURL(
  resolve(process.cwd(), "..", "Vite-AJCI-Chatbot", "public"),
).href;

// Wrap each email body in a full HTML document with a neutral page background,
// matching how a mail client frames the message.
function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin: 0; background-color: #e5e7eb;">
  ${bodyHtml}
</body>
</html>`;
}

const outDir = resolve(process.cwd(), "email-previews");
mkdirSync(outDir, { recursive: true });

const files: { name: string; html: string }[] = [
  {
    name: "pro-upgrade.html",
    html: page(
      "Pro Upgrade Email",
      proUpgradeEmailHtml(SAMPLE_NAME, SAMPLE_URL, LOCAL_ASSET_BASE),
    ),
  },
  {
    name: "pro-cancel.html",
    html: page("Pro Cancellation Email", proCancelEmailHtml(SAMPLE_NAME, SAMPLE_URL)),
  },
];

const written: string[] = [];
for (const f of files) {
  const path = resolve(outDir, f.name);
  writeFileSync(path, f.html, "utf8");
  written.push(path);
  console.log(`  wrote ${path}`);
}

// Best-effort: open the upgrade preview in the default browser (Windows/macOS/Linux).
const first = written[0];
if (first) {
  const platform = process.platform;
  const cmd = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", first] : [first];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // If auto-open fails, the printed paths above are enough.
  }
}

console.log("\nOpen the files above in a browser to preview the emails.");
