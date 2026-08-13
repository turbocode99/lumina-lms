import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, CalendarClock, ClipboardCheck, Route, Trash2 } from "lucide-react";

import {
  deleteAssignmentAction,
  sendDueRemindersAction,
} from "@/app/actions/admin";
import { AssignmentManager } from "@/components/admin/AssignmentManager";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, StatCard } from "@/components/ui/Card";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { daysUntil, formatDate } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Required training" };
export const dynamic = "force-dynamic";

export default async function AdminAssignmentsPage() {
  if (!luminaConfig.features.mandatoryTraining) notFound();
  await requireAdmin("/admin/assignments");

  const now = new Date();

  const [users, courses, paths, assignments, openCount, overdueCount, doneCount] =
    await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          avatarUrl: true,
        },
      }),
      db.course.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
      db.learningPath.findMany({
        where: { isPublished: true },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
      db.assignment.findMany({
        orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
        take: 150,
        include: {
          user: { select: { name: true, email: true, avatarUrl: true, department: true } },
          course: { select: { title: true, slug: true } },
          path: { select: { title: true, slug: true } },
          assignedBy: { select: { name: true } },
        },
      }),
      db.assignment.count({ where: { completedAt: null } }),
      db.assignment.count({
        where: { completedAt: null, dueAt: { lt: now } },
      }),
      db.assignment.count({ where: { completedAt: { not: null } } }),
    ]);

  const departments = Array.from(
    new Set(users.map((u) => u.department).filter((d): d is string => Boolean(d)))
  ).sort();

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Required training
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Assign compliance and onboarding training with due dates, then track
            who has finished.
          </p>
        </div>

        <form action={sendDueRemindersAction}>
          <Button type="submit">
            <BellRing className="h-4 w-4" />
            Send due reminders
          </Button>
        </form>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open"
          value={openCount}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="var(--danger)"
        />
        <StatCard
          label="Completed"
          value={doneCount}
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent="var(--success)"
        />
      </div>

      <AssignmentManager
        users={users}
        courses={courses}
        paths={paths}
        departments={departments}
      />

      {/* Register */}
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] p-5">
          <CardTitle>Assignment register</CardTitle>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Most recent {assignments.length} assignments, open ones first.
          </p>
        </div>

        {assignments.length === 0 ? (
          <p className="py-14 text-center text-sm text-[var(--text-muted)]">
            Nothing assigned yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  {["Person", "Training", "Due", "Status", "Assigned by", ""].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {assignments.map((assignment) => {
                  const days = daysUntil(assignment.dueAt);
                  const done = Boolean(assignment.completedAt);
                  const overdue = !done && days !== null && days < 0;
                  const dueSoon =
                    !done &&
                    days !== null &&
                    days >= 0 &&
                    days <= luminaConfig.learning.dueSoonReminderDays;

                  const title =
                    assignment.course?.title ?? assignment.path?.title ?? "—";
                  const href = assignment.course
                    ? `/courses/${assignment.course.slug}`
                    : assignment.path
                      ? `/paths/${assignment.path.slug}`
                      : "#";

                  return (
                    <tr
                      key={assignment.id}
                      className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--surface-raised)]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={assignment.user.name}
                            src={assignment.user.avatarUrl}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--text-primary)]">
                              {assignment.user.name}
                            </p>
                            {assignment.user.department && (
                              <p className="truncate text-xs text-[var(--text-muted)]">
                                {assignment.user.department}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <Link
                          href={href}
                          className="flex items-center gap-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
                        >
                          {assignment.path && (
                            <Route className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{title}</span>
                        </Link>
                      </td>

                      <td className="px-5 py-3 text-xs text-[var(--text-muted)]">
                        {assignment.dueAt ? formatDate(assignment.dueAt) : "No due date"}
                      </td>

                      <td className="px-5 py-3">
                        {done ? (
                          <Badge tone="success">Completed</Badge>
                        ) : overdue ? (
                          <Badge tone="danger">
                            {Math.abs(days!)}d overdue
                          </Badge>
                        ) : dueSoon ? (
                          <Badge tone="warning">
                            {days === 0 ? "Due today" : `${days}d left`}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Open</Badge>
                        )}
                      </td>

                      <td className="px-5 py-3 text-xs text-[var(--text-muted)]">
                        {assignment.assignedBy.name}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <form action={deleteAssignmentAction}>
                          <input
                            type="hidden"
                            name="assignmentId"
                            value={assignment.id}
                          />
                          <button
                            type="submit"
                            aria-label="Remove assignment"
                            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
