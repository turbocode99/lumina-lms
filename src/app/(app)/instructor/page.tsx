import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Eye,
  MessageCircleQuestion,
  PenSquare,
  Plus,
  Star,
  Users,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Rating } from "@/components/ui/Rating";
import { db } from "@/lib/db";
import { requireInstructor } from "@/lib/rbac";
import { formatDate, formatDuration, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "My courses" };
export const dynamic = "force-dynamic";

export default async function InstructorPage() {
  const user = await requireInstructor("/instructor");

  // Admins oversee everything; instructors see only what they authored.
  const scope = user.role === "ADMIN" ? {} : { instructorId: user.id };

  const courses = await db.course.findMany({
    where: scope,
    orderBy: { updatedAt: "desc" },
    include: {
      category: { select: { name: true, color: true } },
      instructor: { select: { name: true } },
      _count: { select: { enrollments: true, reviews: true, questions: true } },
    },
  });

  const courseIds = courses.map((c) => c.id);

  const [completions, unansweredQuestions] = await Promise.all([
    courseIds.length
      ? db.enrollment.count({
          where: { courseId: { in: courseIds }, completedAt: { not: null } },
        })
      : Promise.resolve(0),
    courseIds.length
      ? db.question.count({
          where: { courseId: { in: courseIds }, answers: { none: {} } },
        })
      : Promise.resolve(0),
  ]);

  const totalLearners = courses.reduce((acc, c) => acc + c._count.enrollments, 0);
  const published = courses.filter((c) => c.status === "PUBLISHED");
  const ratedCourses = courses.filter((c) => c.ratingCount > 0);
  const avgRating = ratedCourses.length
    ? ratedCourses.reduce((acc, c) => acc + c.ratingAvg, 0) / ratedCourses.length
    : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {user.role === "ADMIN" ? "All courses" : "My courses"}
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Build, publish, and keep an eye on how your training is landing.
          </p>
        </div>

        <ButtonLink
          href="/instructor/courses/new"
          variant="primary"
          size="lg"
          data-tour="instructor-new"
        >
          <Plus className="h-5 w-5" />
          New course
        </ButtonLink>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Courses"
          value={courses.length}
          icon={<BookOpen className="h-5 w-5" />}
          trend={{ value: `${published.length} published` }}
        />
        <StatCard
          label="Total enrollments"
          value={totalLearners}
          icon={<Users className="h-5 w-5" />}
          accent="var(--info)"
        />
        <StatCard
          label="Completions"
          value={completions}
          icon={<Eye className="h-5 w-5" />}
          accent="var(--success)"
        />
        <StatCard
          label="Average rating"
          value={avgRating > 0 ? avgRating.toFixed(1) : "—"}
          icon={<Star className="h-5 w-5" />}
          accent="var(--warning)"
        />
      </div>

      {unansweredQuestions > 0 && (
        <Card className="!bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="neu-inset flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--warning)]">
              <MessageCircleQuestion className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--text-primary)]">
                {pluralize(unansweredQuestions, "question")} waiting for an answer
              </p>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                Learners are stuck. Open a course and check its Q&amp;A tab.
              </p>
            </div>
          </div>
        </Card>
      )}

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PenSquare className="h-9 w-9" />}
            title="You haven't created a course yet"
            description="Start with a title and outline — you can add sections, videos, and quizzes as you go."
            action={{ label: "Create your first course", href: "/instructor/courses/new" }}
          />
        </Card>
      ) : (
        <div className="space-y-3" data-tour="instructor-list">
          {courses.map((course) => (
            <Card key={course.id} elevation="sm" className="!p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Thumbnail */}
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl">
                  {course.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${course.category?.color ?? "var(--accent)"}, var(--secondary))`,
                      }}
                    >
                      <BookOpen className="h-5 w-5 text-white/70" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/instructor/courses/${course.id}`}
                      className="truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]"
                    >
                      {course.title}
                    </Link>
                    <StatusBadge status={course.status} />
                    {course.isMandatory && <Badge tone="danger">Required</Badge>}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                    {user.role === "ADMIN" && (
                      <span>by {course.instructor.name}</span>
                    )}
                    <span>{pluralize(course.lessonCount, "lesson")}</span>
                    <span>{formatDuration(course.durationMinutes * 60)}</span>
                    <span>{pluralize(course._count.enrollments, "learner")}</span>
                    <span>Updated {formatDate(course.updatedAt)}</span>
                  </div>
                </div>

                {course.ratingCount > 0 && (
                  <Rating
                    value={course.ratingAvg}
                    count={course.ratingCount}
                    size="sm"
                    className="shrink-0"
                  />
                )}

                <div className="flex shrink-0 gap-2">
                  <ButtonLink
                    href={`/courses/${course.slug}`}
                    size="sm"
                    aria-label="Preview course"
                  >
                    <Eye className="h-4 w-4" />
                  </ButtonLink>
                  <ButtonLink
                    href={`/instructor/courses/${course.id}`}
                    size="sm"
                    variant="primary"
                  >
                    <PenSquare className="h-4 w-4" />
                    Edit
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
