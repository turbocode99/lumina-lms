import "server-only";

import { db } from "@/lib/db";
import { notifyMany } from "@/lib/notify";
import { luminaConfig } from "~/lumina.config";

/**
 * The due-date reminder sweep.
 *
 * One function behind three callers: the admin button, an HTTP endpoint an
 * external scheduler can hit, and the optional in-process timer. None of them
 * needs to know anything the others do, and none can produce a different
 * outcome.
 *
 * Idempotency is the whole design, not a refinement of it. The README plans for
 * "2+ app instances behind a load balancer" from five hundred people upward, so
 * anything that runs on a timer runs on every instance; and a daily schedule
 * would otherwise tell the same person their training is overdue every morning
 * until they did it. Both problems have the same answer.
 *
 * Rows are *claimed* before anything is sent: one UPDATE stamps `lastRemindedAt`
 * on every eligible assignment, and only rows carrying that exact stamp are then
 * notified. A second instance arriving a millisecond later matches nothing,
 * because the rows it would have wanted are no longer stale. The trade-off is
 * that a crash between claiming and sending costs those people one cycle's
 * reminder rather than sending it twice, which for a nag is the right way round.
 */

export interface ReminderRun {
  /** Assignments claimed and notified by this run. */
  sent: number;
  /** Of those, how many were already past their due date. */
  overdue: number;
  /** Eligible rows another run had already claimed. Normal, not an error. */
  skipped: number;
}

export async function runDueReminders(): Promise<ReminderRun> {
  const { dueSoonReminderDays, reminderRepeatDays } = luminaConfig.learning;

  const now = new Date();
  const horizon = new Date(now.getTime() + dueSoonReminderDays * 86_400_000);
  const staleBefore = new Date(now.getTime() - reminderRepeatDays * 86_400_000);

  const due = {
    completedAt: null,
    dueAt: { not: null, lte: horizon },
  } as const;

  const notRecentlyReminded = {
    OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lt: staleBefore } }],
  };

  const eligible = await db.assignment.count({
    where: { ...due, ...notRecentlyReminded },
  });
  if (!eligible) return { sent: 0, overdue: 0, skipped: 0 };

  // The stamp doubles as the claim ticket: it is what marks these rows as ours
  // and what the read below selects on.
  const stamp = new Date();
  await db.assignment.updateMany({
    where: { ...due, ...notRecentlyReminded },
    data: { lastRemindedAt: stamp },
  });

  const claimed = await db.assignment.findMany({
    where: { lastRemindedAt: stamp },
    select: {
      userId: true,
      dueAt: true,
      course: { select: { title: true, slug: true } },
      path: { select: { title: true, slug: true } },
    },
  });

  const nowMs = now.getTime();
  let overdue = 0;

  await notifyMany(
    claimed.map((assignment) => {
      const isOverdue = assignment.dueAt!.getTime() < nowMs;
      if (isOverdue) overdue += 1;
      const title =
        assignment.course?.title ?? assignment.path?.title ?? "Training";

      return {
        userId: assignment.userId,
        type: (isOverdue ? "OVERDUE" : "DUE_SOON") as "OVERDUE" | "DUE_SOON",
        title: isOverdue ? `Overdue: ${title}` : `Due soon: ${title}`,
        body: `Due ${assignment.dueAt!.toLocaleDateString()}.`,
        link: assignment.course
          ? `/courses/${assignment.course.slug}`
          : assignment.path
            ? `/paths/${assignment.path.slug}`
            : "/my-learning",
      };
    })
  );

  return {
    sent: claimed.length,
    overdue,
    skipped: Math.max(0, eligible - claimed.length),
  };
}
