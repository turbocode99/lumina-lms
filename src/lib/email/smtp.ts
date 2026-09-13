import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { EmailDriver, EmailMessage, EmailResult } from "./types";

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  rejectUnauthorized: boolean;
}

/**
 * SMTP delivery, which for an internally-hosted LMS is usually the only
 * transport available — most organisations already run a relay that accepts
 * unauthenticated mail from inside the network.
 */
export class SmtpEmailDriver implements EmailDriver {
  readonly name = "smtp";

  private transporter: Transporter;

  constructor(private options: SmtpOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth:
        options.user && options.pass
          ? { user: options.user, pass: options.pass }
          : undefined,
      tls: { rejectUnauthorized: options.rejectUnauthorized },
      // Pooling is what makes the bulk paths reasonable: one assignment to a
      // 200-person department is 200 messages, and without a pool that is 200
      // TCP handshakes and TLS negotiations.
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
    });
  }

  async send(messages: EmailMessage[]): Promise<EmailResult> {
    let sent = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        await this.transporter.sendMail({
          from: this.options.from,
          to: message.toName
            ? { name: message.toName, address: message.to }
            : message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        // One bad address must not cost the rest of the batch their mail, so
        // this is logged and stepped over rather than thrown.
        console.error(
          `[lumina:email] failed to send to ${message.to}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return { sent, failed };
  }
}
