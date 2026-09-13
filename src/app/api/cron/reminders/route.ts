import { NextResponse, type NextRequest } from "next/server";

import { runDueReminders } from "@/lib/reminders";

/**
 * Due-date reminders, for whatever already schedules things where this is
 * deployed — crontab, a systemd timer, a Kubernetes CronJob, Windows Task
 * Scheduler, or a hosted cron service.
 *
 * An endpoint rather than a timer inside the app, and that is a decision rather
 * than a shortcut. The README plans for "2+ app instances behind a load
 * balancer" from five hundred people upward, and a timer in a web process runs
 * on every one of them, dies with the process, and has nowhere to report a
 * failure except the log. Every environment this lands in already has something
 * that can make an HTTP request on a schedule and shout when it does not.
 *
 * Called more often than `reminderRepeatDays`, this is harmless: the sweep
 * claims rows before sending, so extra runs find nothing to do.
 *
 *   curl -X POST https://lms.example.com/api/cron/reminders \
 *        -H "Authorization: Bearer $CRON_SECRET"
 */

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header =
    request.headers.get("authorization") ?? request.headers.get("x-cron-secret");
  if (!header) return false;

  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;

  // Length-independent comparison would be better still, but the secret is a
  // fixed value the operator sets, not something an attacker can grow or shrink
  // to leak length by timing. The constant-time compare below is the part that
  // matters.
  if (presented.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i += 1) {
    mismatch |= presented.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    // Refusing beats running unauthenticated. An open endpoint that sends mail
    // to every person with overdue training is a denial-of-inbox waiting to be
    // found by anyone scanning for it.
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so this endpoint is disabled." },
      { status: 503 }
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await runDueReminders();
    return NextResponse.json({ ok: true, ...run });
  } catch (error) {
    console.error("[lumina] reminder sweep failed:", error);
    return NextResponse.json({ error: "Reminder sweep failed" }, { status: 500 });
  }
}

/** Some schedulers only do GET. Same behaviour, same auth. */
export async function GET(request: NextRequest) {
  return POST(request);
}
