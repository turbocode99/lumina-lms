import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  CompletionByDepartmentChart,
  EnrollmentsByCategoryChart,
  TopCoursesChart,
} from "@/components/admin/AdminCharts";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardTitle, StatCard } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { cn, formatRelative, truncate } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Admin overview" };
export const dynamic = "force-dynamic";

/**
 * Maps an activity-log entry to the page showing that record. Returns null when
 * there is nowhere sensible to go, so the row renders as static text rather than
 * a link that lands on a 404.
 */
function activityHref(entity: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entity) {
    case "course":
      return `/instructor/courses/${entityId}`;
    case "user":
      return "/admin/users";
    case "path":
      return "/admin/paths";
    case "assignment":
      return "/admin/assignments";
    default:
      return null;
  }
}

export default async function AdminOverviewPage() {
  await requireAdmin("/admin");

  const [
    userCount,
    activeUserCount,
    courseCount,
    publishedCount,
    enrollmentCount,
    completionCount,
    certificateCount,
    openAssignments,
    overdueAssignments,
    categories,
    topCourses,
    recentActivity,
    departments,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.course.count(),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.enrollment.count(),
    db.enrollment.count({ where: { completedAt: { not: null } } }),
    db.certificate.count(),
    db.assignment.count({ where: { completedAt: null } }),
    db.assignment.count({
      where: { completedAt: null, dueAt: { lt: new Date() } },
    }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: {
        name: true,
        color: true,
        courses: { select: { enrollmentCount: true } },
      },
    }),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { enrollmentCount: "desc" },
      take: 7,
      select: { id: true, slug: true, title: true, enrollmentCount: true },
    }),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true, avatarUrl: true } } },
    }),
    db.user.groupBy({
      by: ["department"],
      where: { department: { not: null } },
      _count: { department: true },
    }),
  ]);

  // Enrollment split by category, for the donut.
  const categoryData = categories
    .map((category) => ({
      name: category.name,
      value: category.courses.reduce((acc, c) => acc + c.enrollmentCount, 0),
      color: category.color,
    }))
    .filter((entry) => entry.value > 0);

  // Completion split by department, for the bar chart.
  const departmentNames = departments
    .map((d) => d.department)
    .filter((d): d is string => Boolean(d))
    .slice(0, 8);

  const departmentData = await Promise.all(
    departmentNames.map(async (department) => {
      const [completed, inProgress] = await Promise.all([
        db.enrollment.count({
          where: { completedAt: { not: null }, user: { department } },
        }),
        db.enrollment.count({
          where: {
            completedAt: null,
            progressPercent: { gt: 0 },
            user: { department },
          },
        }),
      ]);
      return { department: truncate(department, 14), completed, inProgress };
    })
  );

  const completionRate = enrollmentCount
    ? Math.round((completionCount / enrollmentCount) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Organisation overview
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          How learning is tracking across {luminaConfig.brand.organization}.
        </p>
      </header>

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="People"
          value={userCount}
          icon={<Users className="h-5 w-5" />}
          trend={{ value: `${activeUserCount} active` }}
          href="/admin/users"
          hint="Manage people"
        />
        <StatCard
          label="Courses"
          value={courseCount}
          icon={<BookOpen className="h-5 w-5" />}
          accent="var(--info)"
          trend={{ value: `${publishedCount} published` }}
          href="/admin/courses"
          hint="Moderate courses"
        />
        <StatCard
          label="Enrollments"
          value={enrollmentCount}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="var(--secondary)"
          trend={{ value: `${completionCount} completed` }}
          href="/admin/courses?status=PUBLISHED"
          hint="View published courses"
        />
        <StatCard
          label="Certificates"
          value={certificateCount}
          icon={<Award className="h-5 w-5" />}
          accent="var(--warning)"
          href="/admin/certificates"
          hint="View register"
        />
      </div>

      {/* Compliance strip */}
      {luminaConfig.features.mandatoryTraining && (
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/assignments?status=open"
            className="neu-interactive group rounded-[var(--radius-neu)] p-6"
          >
            <div className="flex items-center gap-4">
              <span className="neu-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[var(--accent)]">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                  {openAssignments}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Open required assignments
                </p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-semibold text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                Review →
              </span>
            </div>
          </Link>

          <Link
            href="/admin/assignments?status=overdue"
            className={cn(
              "neu-interactive group rounded-[var(--radius-neu)] p-6",
              overdueAssignments > 0 &&
                "!bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))]"
            )}
          >
            <div className="flex items-center gap-4">
              <span
                className="neu-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  color:
                    overdueAssignments > 0 ? "var(--danger)" : "var(--success)",
                }}
              >
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                  {overdueAssignments}
                </p>
                <p className="text-xs text-[var(--text-muted)]">Overdue</p>
              </div>
              <span
                className="ml-auto shrink-0 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  color:
                    overdueAssignments > 0 ? "var(--danger)" : "var(--accent)",
                }}
              >
                Review →
              </span>
            </div>
          </Link>

          <Link
            href="/admin/courses?status=PUBLISHED"
            className="neu-interactive group rounded-[var(--radius-neu)] p-6"
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Overall completion rate
            </p>
            <p className="mb-3 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {completionRate}%
            </p>
            <Progress value={completionRate} size="sm" />
            <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
              Browse courses →
            </span>
          </Link>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-1">Enrollments by category</CardTitle>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Where your people are spending their learning time.
          </p>
          <EnrollmentsByCategoryChart data={categoryData} />
        </Card>

        <Card>
          <CardTitle className="mb-1">Completion by department</CardTitle>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Completed versus still-in-progress enrollments.
          </p>
          <CompletionByDepartmentChart data={departmentData} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle className="mb-1">Most enrolled courses</CardTitle>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Top {topCourses.length} by total enrollments.
          </p>
          <TopCoursesChart
            data={topCourses.map((course) => ({
              name: truncate(course.title, 22),
              enrollments: course.enrollmentCount,
            }))}
          />
        </Card>

        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--accent)]" />
            Recent activity
          </CardTitle>

          {recentActivity.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              No activity recorded yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {recentActivity.map((entry) => {
                // Resolve each log line to the record it is about, so the feed is
                // a way into the data rather than a read-only ticker.
                const target = activityHref(entry.entity, entry.entityId);

                const row = (
                  <>
                    <Avatar
                      name={entry.user.name}
                      src={entry.user.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-[var(--text-primary)]">
                        <span className="font-medium">{entry.user.name}</span>{" "}
                        <span className="text-[var(--text-muted)]">
                          {entry.action.replace(/[._]/g, " ")}
                        </span>
                      </span>
                      <span className="block text-xs text-[var(--text-muted)]">
                        {formatRelative(entry.createdAt)}
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={entry.id}>
                    {target ? (
                      <Link
                        href={target}
                        className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-raised)]"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 px-2 py-2">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/admin/users", label: "Manage people", icon: <Users className="h-5 w-5" /> },
          { href: "/admin/courses", label: "Moderate courses", icon: <BookOpen className="h-5 w-5" /> },
          { href: "/admin/paths", label: "Learning paths", icon: <GraduationCap className="h-5 w-5" /> },
          {
            href: "/admin/assignments",
            label: "Required training",
            icon: <ClipboardCheck className="h-5 w-5" />,
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="neu-interactive flex items-center gap-3 rounded-[var(--radius-neu)] p-5"
          >
            <span className="neu-inset flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--accent)]">
              {link.icon}
            </span>
            <span className="font-medium text-[var(--text-primary)]">
              {link.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
