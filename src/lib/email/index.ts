import "server-only";

import { ConsoleEmailDriver } from "./console";
import { SmtpEmailDriver } from "./smtp";
import type { EmailDriver, EmailMessage, EmailResult } from "./types";

export type { EmailDriver, EmailMessage, EmailResult } from "./types";
export { renderNotificationEmail } from "./render";

/**
 * Driver registry, mirroring `src/lib/storage/index.ts`.
 *
 * The default is "none", so an existing deployment that pulls this in and
 * changes nothing keeps behaving exactly as it did. Email is opt-in.
 */

class NoopEmailDriver implements EmailDriver {
  readonly name = "none";
  async send(): Promise<EmailResult> {
    return { sent: 0, failed: 0 };
  }
}

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createDriver(): EmailDriver {
  const name = (process.env.EMAIL_DRIVER || "none").toLowerCase();

  switch (name) {
    case "none":
      return new NoopEmailDriver();

    case "console":
      return new ConsoleEmailDriver();

    case "smtp": {
      const host = process.env.SMTP_HOST?.trim();
      const from = process.env.EMAIL_FROM?.trim();

      // Refusing here beats sending broken mail. A missing host cannot work at
      // all, and a missing From is rejected by most relays anyway.
      if (!host || !from) {
        console.error(
          '[lumina:email] EMAIL_DRIVER="smtp" needs SMTP_HOST and EMAIL_FROM. ' +
            "Email notifications are disabled until both are set."
        );
        return new NoopEmailDriver();
      }

      const port = numberFrom(process.env.SMTP_PORT, 587);
      return new SmtpEmailDriver({
        host,
        port,
        // 465 is implicit TLS; 587 and 25 start plaintext and upgrade.
        secure: process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === "true"
          : port === 465,
        user: process.env.SMTP_USER?.trim() || undefined,
        pass: process.env.SMTP_PASSWORD || undefined,
        from,
        // Internal relays very often present a self-signed certificate. This
        // defaults to strict and has to be turned off deliberately.
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
      });
    }

    default:
      console.warn(
        `[lumina:email] Unknown EMAIL_DRIVER "${name}", falling back to "none".`
      );
      return new NoopEmailDriver();
  }
}

const globalForEmail = globalThis as unknown as {
  luminaEmail: EmailDriver | undefined;
};

export const email: EmailDriver = globalForEmail.luminaEmail ?? createDriver();

if (process.env.NODE_ENV !== "production") {
  globalForEmail.luminaEmail = email;
}

export function isEmailEnabled(): boolean {
  return email.name !== "none";
}

/**
 * Turns a notification's relative link into something clickable from an inbox.
 *
 * Returns null when APP_URL is unset, and the template then omits the button
 * rather than shipping a dead relative href — a "/courses/x" link in an email
 * resolves against the mail client, which is nowhere.
 */
export function absoluteUrl(link: string | null | undefined): string | null {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (!base || !link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return `${base}${link.startsWith("/") ? "" : "/"}${link}`;
}

let warnedAboutMissingAppUrl = false;

/**
 * Sends a batch, absorbing every failure. Callers are notification writes that
 * have already succeeded; none of them should fail because a relay was down.
 */
export async function sendEmails(messages: EmailMessage[]): Promise<EmailResult> {
  if (!messages.length || !isEmailEnabled()) return { sent: 0, failed: 0 };

  if (!process.env.APP_URL?.trim() && !warnedAboutMissingAppUrl) {
    warnedAboutMissingAppUrl = true;
    console.warn(
      "[lumina:email] APP_URL is not set, so notification emails are going out " +
        "without a link back. Set it to the address staff use to reach Lumina."
    );
  }

  try {
    return await email.send(messages);
  } catch (error) {
    console.error("[lumina:email] transport threw:", error);
    return { sent: 0, failed: messages.length };
  }
}
