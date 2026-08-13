import "server-only";

import { db } from "@/lib/db";
import { luminaConfig } from "~/lumina.config";
import type { NotificationType } from "@/lib/enums";

/**
 * In-app notifications. Kept behind one function so adding an email or Slack
 * transport later means editing this file only — every call site already
 * supplies a title, body, and deep link.
 */

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
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
