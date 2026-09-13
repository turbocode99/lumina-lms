import "server-only";

import { after } from "next/server";

import { db } from "@/lib/db";
import { luminaConfig, type NotificationKind } from "~/lumina.config";
import {
  absoluteUrl,
  isEmailEnabled,
  renderNotificationEmail,
  sendEmails,
  type EmailMessage,
} from "@/lib/email";
import type { NotificationType } from "@/lib/enums";

/**
 * Notifications. One function in front of every channel, so a call site says
 * what happened and this file decides where it goes.
 *
 * In-app is unconditional; email is opt-in per deployment (EMAIL_DRIVER) and
 * per notification type (`emailNotifications` in lumina.config.ts). Adding Slack
 * or Teams later means another branch here and nothing else.
 */

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * `lumina.config.ts` restates the notification types rather than importing them,
 * to stay free of `src` imports. This fails the build if the two lists drift —
 * a type added to one and not the other would otherwise silently never email.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const NOTIFICATION_KINDS_MATCH: Exact<NotificationKind, NotificationType> = true;
void NOTIFICATION_KINDS_MATCH;

function emailsThisType(type: NotificationType): boolean {
  return luminaConfig.emailNotifications.includes(type);
}

/**
 * Resolves recipients and hands the batch to the transport.
 *
 * Deactivated accounts are filtered out here rather than at the call sites: a
 * leaver still has notification rows written against them, which is correct for
 * the audit trail, but mailing someone who has been offboarded is not.
 */
async function deliverEmails(inputs: NotifyInput[]): Promise<void> {
  const emailable = inputs.filter((input) => emailsThisType(input.type));
  if (!emailable.length) return;

  const recipients = await db.user.findMany({
    where: {
      id: { in: [...new Set(emailable.map((i) => i.userId))] },
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  });

  const byId = new Map(recipients.map((user) => [user.id, user]));

  const messages: EmailMessage[] = [];
  for (const input of emailable) {
    const user = byId.get(input.userId);
    if (!user?.email) continue;

    const rendered = renderNotificationEmail({
      recipientName: user.name,
      title: input.title,
      body: input.body,
      url: absoluteUrl(input.link),
    });

    messages.push({
      to: user.email,
      toName: user.name,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  await sendEmails(messages);
}

/**
 * Runs delivery after the response has been sent.
 *
 * Assigning required training to a whole department is hundreds of messages;
 * awaiting an SMTP relay inline would leave the admin watching a spinner for the
 * length of the batch, and a slow relay would look like a broken button. `after`
 * needs a request scope, so anything calling this from a script or a background
 * job falls back to awaiting inline rather than losing the mail.
 */
function scheduleEmails(inputs: NotifyInput[]): void {
  if (!isEmailEnabled()) return;

  const run = async () => {
    try {
      await deliverEmails(inputs);
    } catch (error) {
      // The in-app notification is already written and the user's action has
      // already succeeded. Email is the best-effort half.
      console.error("[lumina:email] delivery failed:", error);
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}

export async function notify(input: NotifyInput): Promise<void> {
  if (!luminaConfig.features.notifications) return;
  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    },
  });
  scheduleEmails([input]);
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (!luminaConfig.features.notifications || !inputs.length) return;
  await db.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body ?? null,
      link: i.link ?? null,
    })),
  });
  scheduleEmails(inputs);
}

export async function unreadCount(userId: string): Promise<number> {
  if (!luminaConfig.features.notifications) return 0;
  return db.notification.count({ where: { userId, read: false } });
}

/** Append-only audit trail for admin-visible actions. */
export async function logActivity(input: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  await db.activityLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
  });
}
