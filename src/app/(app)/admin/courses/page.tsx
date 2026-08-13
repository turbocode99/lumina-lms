import type { Metadata } from "next";
import Link from "next/link";
import { Archive, BookOpen, Globe, PenSquare } from "lucide-react";

import { adminSetCourseStatusAction } from "@/app/actions/admin";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Rating } from "@/components/ui/Rating";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { formatDate, formatDuration, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "All courses" };
export const dynamic = "force-dynamic";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("/admin/courses");
  const { status } = await searchParams;

  const where =
    status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)
      ? { status }
      : {};

  const [courses, counts] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        instructor: { select: { name: true } },
        category: { select: { name: true, color: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    db.course.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  const countFor = (value: string) =>
    counts.find((c) => c.status === value)?._count.status ?? 0;

  const filters = [
    { value: "", label: "All", count: counts.reduce((a, c) => a + c._count.status, 0) },
    { value: "PUBLISHED", label: "Published", count: countFor("PUBLISHED") },
    { value: "DRAFT", label: "Draft", count: countFor("DRAFT") },
    { value: "ARCHIVED", label: "Archived", count: countFor("ARCHIVED") },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          All courses
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Every course on the platform, whoever authored it.
        </p>
      </header>

      <div className="neu-inset mb-6 inline-flex gap-1 rounded-2xl p-1.5">
        {filters.map((filter) => {
          const active = (status ?? "") === filter.value;
          return (
            <Link
              key={filter.value || "all"}
              href={
                filter.value
                  ? `/admin/courses?status=${filter.value}`
                  : "/admin/courses"
              }
              className={
                active
                  ? "neu-sm flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--accent)]"
                  : "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              }
            >
              {filter.label}
              <span className="text-xs tabular-nums opacity-70">
                {filter.count}
              </span>
            </Link>
          );
        })}
      </div>

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-9 w-9" />}
            title="No courses here"
            description="Nothing matches this filter yet."
            action={{ label: "Create a course", href: "/instructor/courses/new" }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Card key={course.id} elevation="sm" className="!p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-14 w-24 shrink-0 overflow-hidden rounded-xl">
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
                      <BookOpen className="h-4 w-4 text-white/70" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/courses/${course.slug}`}
                      className="truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]"
                    >
                      {course.title}
                    </Link>
                    <StatusBadge status={course.status} />
                    {course.isMandatory && <Badge tone="danger">Required</Badge>}
                    {course.category && (
                      <Badge
                        tone="outline"
                        style={{ color: course.category.color }}
                      >
                        {course.category.name}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span>by {course.instructor.name}</span>
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

                <div className="flex shrink-0 flex-wrap gap-2">
                  {course.status !== "PUBLISHED" ? (
                    <form action={adminSetCourseStatusAction}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="status" value="PUBLISHED" />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={course.lessonCount === 0}
                        title={
                          course.lessonCount === 0
                            ? "Course has no lessons"
                            : undefined
                        }
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Publish
                      </Button>
                    </form>
                  ) : (
                    <form action={adminSetCourseStatusAction}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="status" value="ARCHIVED" />
                      <Button type="submit" size="sm">
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    </form>
                  )}

                  <ButtonLink
                    href={`/instructor/courses/${course.id}`}
                    size="sm"
                    variant="primary"
                  >
                    <PenSquare className="h-3.5 w-3.5" />
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
