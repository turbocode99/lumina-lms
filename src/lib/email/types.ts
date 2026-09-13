/**
 * Email driver contract.
 *
 * Notifications never reach a mail server directly — everything goes through
 * this interface, the same way course media goes through `StorageDriver`. To
 * send through Postmark, SES, or Resend instead of SMTP, implement `send` in a
 * new file and register it in `src/lib/email/index.ts`. No other file changes.
 *
 * `send` takes an array rather than one message because the two bulk callers —
 * assigning required training to a department, and the due-date sweep — can
 * produce hundreds at once, and every real transport is far happier reusing one
 * connection than opening hundreds.
 */

export interface EmailMessage {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  sent: number;
  failed: number;
}

export interface EmailDriver {
  readonly name: string;

  /**
   * Delivers a batch. Implementations must not throw: a mail server being down
   * is not a reason for an admin's assignment action to fail, and the in-app
   * notification has already been written by the time this runs. Report the
   * failure count instead and log the detail.
   */
  send(messages: EmailMessage[]): Promise<EmailResult>;
}
