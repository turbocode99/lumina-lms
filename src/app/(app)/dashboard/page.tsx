import type { Metadata } from "next";
import Link from "next/link";
import {
  Award,
  BookOpen,
  CalendarClock,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  Route,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { CourseCard, type CourseCardData } from "@/components/CourseCard";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardTitle, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Progress, ProgressRing } from "@/components/ui/Progress";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { daysUntil, formatDuration, pluralize } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const [
    enrollments,
    dueAssignments,
    certificateCount,
    recommended,
    pathEnrollments,
  ] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: user.id },
      orderBy: [{ startedAt: "desc" }, { enrolledAt: "desc" }],
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            thumbnailUrl: true,
            level: true,
            durationMinutes: true,
            lessonCount: true,
            ratingAvg: true,
            ratingCount: true,
            enrollmentCount: true,
            isMandatory: true,
            instructor: { select: { name: true } },
            category: { select: { name: true, color: true } },
          },
        },
      },
    }),

    luminaConfig.features.mandatoryTraining
      ? db.assignment.findMany({
          where: { userId: user.id, completedAt: null },
          orderBy: [{ dueAt: "asc" }],
          take: 5,
          include: {
            course: { select: { slug: true, title: true, durationMinutes: true } },
            path: { select: { slug: true, title: true } },
          },
        })
      : Promise.resolve([]),

    luminaConfig.features.certificates
      ? db.certificate.count({ where: { userId: user.id } })
      : Promise.resolve(0),

    db.course.findMany({
      where: {
        status: "PUBLISHED",
        enrollments: { none: { userId: user.id } },
      },
      orderBy: [{ enrollmentCount: "desc" }, { ratingAvg: "desc" }],
      take: 4,
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        thumbnailUrl: true,
        level: true,
        durationMinutes: true,
        lessonCount: true,
        ratingAvg: true,
        ratingCount: true,
        enrollmentCount: true,
        isMandatory: true,
        instructor: { select: { name: true } },
        category: { select: { name: true, color: true } },
      },
    }),

    luminaConfig.features.learningPaths
      ? db.pathEnrollment.findMany({
          where: { userId: user.id, completedAt: null },
          orderBy: { enrolledAt: "desc" },
          take: 3,
          include: {
            path: {
              select: {
                slug: true,
                title: true,
                color: true,
                _count: { select: { items: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const inProgress = enrollments.filter(
    (e) => e.progressPercent > 0 && e.progressPercent < 100
  );
  const notStarted = enrollments.filter((e) => e.progressPercent === 0);
  const completed = enrollments.filter((e) => e.progressPercent >= 100);

  const continueLearning = [...inProgress, ...notStarted].slice(0, 4);

  const totalMinutes = enrollments.reduce(
    (acc, e) => acc + Math.round((e.course.durationMinutes * e.progressPercent) / 100),
    0
  );

  const overallProgress = enrollments.length
    ? Math.round(
        enrollments.reduce((acc, e) => acc + e.progressPercent, 0) /
          enrollments.length
      )
    : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      {/* Hero */}
      <section className="neu overflow-hidden rounded-[var(--radius-neu-lg)] p-7 sm:p-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {greeting()}, {user.name.split(" ")[0]}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {inProgress.length > 0 ? (
                <>
                  You have{" "}
                  <span className="text-gradient">
                    {pluralize(inProgress.length, "course")}
                  </span>{" "}
                  in progress
                </>
              ) : enrollments.length > 0 ? (
                <>Ready for your next lesson?</>
              ) : (
                <>Let&apos;s find your first course</>
              )}
            </h1>
            <p className="mt-3 max-w-lg text-[var(--text-secondary)]">
              {enrollments.length > 0
                ? `You've invested about ${formatDuration(totalMinutes * 60)} in learning so far. Keep the streak going.`
                : `Browse the ${luminaConfig.brand.organization} catalog and enroll in whatever's relevant to your role.`}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {continueLearning[0] ? (
                <ButtonLink
                  href={`/courses/${continueLearning[0].course.slug}`}
                  variant="primary"
                  size="lg"
                >
                  <Flame className="h-4 w-4" />
                  Continue learning
                </ButtonLink>
              ) : (
                <ButtonLink href="/catalog" variant="primary" size="lg">
                  <Compass className="h-4 w-4" />
                  Browse catalog
                </ButtonLink>
              )}
              <ButtonLink href="/my-learning" size="lg">
                My learning
              </ButtonLink>
            </div>
          </div>

          {enrollments.length > 0 && (
            <div className="flex shrink-0 items-center justify-center lg:pr-6">
              <ProgressRing value={overallProgress} size={168} strokeWidth={13}>
                <span className="text-4xl font-bold tabular-nums text-[var(--text-primary)]">
                  {overallProgress}%
                </span>
                <span className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
                  overall
                </span>
              </ProgressRing>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Enrolled"
          value={enrollments.length}
          icon={<BookOpen className="h-5 w-5" />}
        />
        <StatCard
          label="In progress"
          value={inProgress.length}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="var(--info)"
        />
        <StatCard
          label="Completed"
          value={completed.length}
          icon={<GraduationCap className="h-5 w-5" />}
          accent="var(--success)"
        />
        <StatCard
          label="Certificates"
          value={certificateCount}
          icon={<Award className="h-5 w-5" />}
          accent="var(--warning)"
        />
      </section>

      {/* Required training */}
      {dueAssignments.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--text-primary)]">
              <ShieldAlert className="h-5 w-5 text-[var(--danger)]" />
              Required training
            </h2>
          </div>

          <div className="space-y-3">
            {dueAssignments.map((assignment) => {
              const days = daysUntil(assignment.dueAt);
              const overdue = days !== null && days < 0;
              const dueSoon =
                days !== null &&
                days >= 0 &&
                days <= luminaConfig.learning.dueSoonReminderDays;

              const target = assignment.course
                ? `/courses/${assignment.course.slug}`
                : assignment.path
                  ? `/paths/${assignment.path.slug}`
                  : "/my-learning";
              const title =
                assignment.course?.title ?? assignment.path?.title ?? "Assigned training";

              return (
                <Link
                  key={assignment.id}
                  href={target}
                  className="neu-interactive flex flex-wrap items-center gap-4 rounded-[var(--radius-neu)] p-4"
                >
                  <span
                    className="neu-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      color: overdue
                        ? "var(--danger)"
                        : dueSoon
                          ? "var(--warning)"
                          : "var(--accent)",
                    }}
                  >
                    {assignment.path ? (
                      <Route className="h-5 w-5" />
                    ) : (
                      <BookOpen className="h-5 w-5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--text-primary)]">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {assignment.note ||
                        (assignment.path ? "Learning path" : "Course")}
                    </p>
                  </div>

                  {assignment.dueAt && (
                    <Badge
                      tone={overdue ? "danger" : dueSoon ? "warning" : "neutral"}
                      icon={<CalendarClock className="h-3 w-3" />}
                    >
                      {overdue
                        ? `${Math.abs(days!)}d overdue`
                        : days === 0
                          ? "Due today"
                          : `Due in ${days}d`}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Continue learning */}
      {continueLearning.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Pick up where you left off
            </h2>
            <Link
              href="/my-learning"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {continueLearning.map((enrollment) => (
              <CourseCard
                key={enrollment.id}
                course={enrollment.course as CourseCardData}
                progress={enrollment.progressPercent}
              />
            ))}
          </div>
        </section>
      )}

      {/* Learning paths */}
      {pathEnrollments.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Your learning paths
            </h2>
            <Link
              href="/paths"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {pathEnrollments.map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/paths/${enrollment.path.slug}`}
                className="neu-interactive rounded-[var(--radius-neu)] p-5"
              >
                <span
                  className="neu-inset mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ color: enrollment.path.color }}
                >
                  <Route className="h-5 w-5" />
                </span>
                <h3 className="line-clamp-2 font-semibold text-[var(--text-primary)]">
                  {enrollment.path.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {pluralize(enrollment.path._count.items, "course")}
                </p>
                <Progress
                  value={enrollment.progressPercent}
                  size="sm"
                  showLabel
                  color={enrollment.path.color}
                  className="mt-4"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Popular at {luminaConfig.brand.organization}
            </h2>
            <Link
              href="/catalog"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Browse catalog
            </Link>
          </div>

          <div className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {recommended.map((course) => (
              <CourseCard key={course.id} course={course as CourseCardData} />
            ))}
          </div>
        </section>
      )}

      {enrollments.length === 0 && recommended.length === 0 && (
        <Card>
          <EmptyState
            icon={<Compass className="h-9 w-9" />}
            title="Nothing here yet"
            description="No published courses are available. If you're an administrator, create the first one to get started."
            action={{ label: "Go to catalog", href: "/catalog" }}
          />
        </Card>
      )}

      {/* Recently completed */}
      {completed.length > 0 && (
        <section>
          <Card>
            <CardTitle className="mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-[var(--success)]" />
              Recently completed
            </CardTitle>
            <div className="space-y-2">
              {completed.slice(0, 5).map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/courses/${enrollment.course.slug}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-raised)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]">
                    {enrollment.course.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Clock className="h-3 w-3" />
                    {formatDuration(enrollment.course.durationMinutes * 60)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
