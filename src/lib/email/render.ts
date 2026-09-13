import "server-only";

import { luminaConfig } from "~/lumina.config";

/**
 * Notification to email.
 *
 * Deliberately plain HTML: tables, inline styles, no custom properties, no
 * flexbox. The neumorphic design system does not survive a mail client — Outlook
 * renders with Word's engine, Gmail strips <style> blocks — so this borrows only
 * the accent colour and otherwise stays in the subset that renders everywhere.
 * Every message also carries a real text/plain alternative rather than a
 * stripped-tags afterthought.
 */

export interface RenderInput {
  recipientName: string;
  title: string;
  body?: string | null;
  /** Absolute URL, already resolved from APP_URL. */
  url?: string | null;
}

/**
 * HTML-escapes. Notification titles carry course names, and a course called
 * `Security & <you>` must not be able to inject markup into staff inboxes.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderNotificationEmail(input: RenderInput): {
  subject: string;
  html: string;
  text: string;
} {
  const brand = luminaConfig.brand;
  const accent = luminaConfig.theme.accent;

  const greeting = input.recipientName
    ? `Hi ${input.recipientName.split(" ")[0]},`
    : "Hi,";

  const subject = input.title;

  const button =
    input.url &&
    `<tr><td style="padding:24px 32px 8px 32px">
        <a href="${escapeHtml(input.url)}"
           style="display:inline-block;background:${escapeHtml(accent)};color:#ffffff;
                  text-decoration:none;font-weight:600;font-size:15px;
                  padding:12px 24px;border-radius:8px">Open in ${escapeHtml(
                    brand.name
                  )}</a>
      </td></tr>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:12px;
                font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                color:#1a1a1a">
   <tr><td style="padding:28px 32px 0 32px;font-size:13px;font-weight:600;
                  letter-spacing:.08em;text-transform:uppercase;color:#6b7280">
     ${escapeHtml(brand.name)}
   </td></tr>
   <tr><td style="padding:16px 32px 0 32px;font-size:15px;color:#4b5563">
     ${escapeHtml(greeting)}
   </td></tr>
   <tr><td style="padding:12px 32px 0 32px;font-size:20px;font-weight:700;line-height:1.35">
     ${escapeHtml(input.title)}
   </td></tr>
   ${
     input.body
       ? `<tr><td style="padding:12px 32px 0 32px;font-size:15px;line-height:1.6;color:#4b5563">
            ${escapeHtml(input.body)}
          </td></tr>`
       : ""
   }
   ${button || ""}
   <tr><td style="padding:28px 32px 28px 32px;font-size:12px;line-height:1.6;color:#9ca3af;
                  border-top:1px solid #eceef1">
     Sent by ${escapeHtml(brand.name)} for ${escapeHtml(brand.organization)}.
     Questions? Contact <a href="mailto:${escapeHtml(brand.supportEmail)}"
       style="color:#6b7280">${escapeHtml(brand.supportEmail)}</a>.
   </td></tr>
  </table>
 </td></tr>
</table>
</body></html>`;

  const text = [
    greeting,
    "",
    input.title,
    input.body ? `\n${input.body}` : "",
    input.url ? `\nOpen in ${brand.name}: ${input.url}` : "",
    "",
    "—",
    `Sent by ${brand.name} for ${brand.organization}.`,
    `Questions? Contact ${brand.supportEmail}.`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
