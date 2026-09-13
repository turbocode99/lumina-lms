import "server-only";

import type { EmailDriver, EmailMessage, EmailResult } from "./types";

/**
 * Prints what would have been sent. This is what `EMAIL_DRIVER="console"` gets
 * you: the full wiring — templates, recipient resolution, type filtering — with
 * no mail server and nothing leaving the machine, which is the only safe way to
 * develop against a feature whose failure mode is emailing real staff.
 */
export class ConsoleEmailDriver implements EmailDriver {
  readonly name = "console";

  async send(messages: EmailMessage[]): Promise<EmailResult> {
    for (const message of messages) {
      const recipient = message.toName
        ? `${message.toName} <${message.to}>`
        : message.to;
      console.info(
        `\n[lumina:email] ── would send ──────────────────────────────\n` +
          `  to:      ${recipient}\n` +
          `  subject: ${message.subject}\n` +
          `${message.text
            .trim()
            .split("\n")
            .map((line) => `  │ ${line}`)
            .join("\n")}\n` +
          `[lumina:email] ───────────────────────────────────────────\n`
      );
    }
    return { sent: messages.length, failed: 0 };
  }
}
