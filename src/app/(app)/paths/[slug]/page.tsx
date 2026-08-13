import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  PlayCircle,
  Route,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress, ProgressRing } from "@/components/ui/Progress";
import { enrollInPathAction } from "@/app/actions/learning";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { formatDuration, pluralize } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = await db.learningPath.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });
  return {
    title: path?.title ?? "Learning path",
    description: path?.description ?? undefined,
  };
}

export default async function PathDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!luminaConfig.features.learningPaths) notFound();

  const { slug } = await params;
  const user = await requireUser(`/paths/${slug}`);

  const path = await db.learningPath.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { enrollments: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              subtitle: true,
              durationMinutes: true,
              lessonCount: true,
              level: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!path) notFound();
  if (!path.isPublished && user.role !== "ADMIN") notFound();

  const [pathEnrollment, courseEnrollments] = await Promise.all([
    db.pathEnrollment.findUnique({
      where: { userId_pathId: { userId: user.id, pathId: path.id } },
      select: { progressPercent: true, completedAt: true },
    }),
    db.enrollment.findMany({
      where: {
        userId: user.id,
        courseId: { in: path.items.map((i) => i.courseId) },
      },
      select: { courseId: true, progressPercent: true, lastLessonId: true },
    }),
  ]);

  const progressByCourse = new Map(
    courseEnrollments.map((e) => [e.courseId, e])
  );

  const totalMinutes = path.items.reduce(
    (acc, item) => acc + item.course.durationMinutes,
    0
  );
  const totalLessons = path.items.reduce(
    (acc, item) => acc + item.course.lessonCount,
    0
  );

  const enrolled = Boolean(pathEnrollment);

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Hero */}
      <Card elevation="lg" className="mb-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div
              className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${path.color}, color-mix(in srgb, ${path.color} 50%, var(--secondary)))`,
              }}
            >
              <Route className="h-8 w-8 text-white" />
            </div>

            {!path.isPublished && (
              <Badge tone="warning" className="mb-3">
                Draft — visible to admins only
              </Badge>
            )}

            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {path.title}
            </h1>

            {path.description && (
              <p className="mt-3 text-lg leading-relaxed text-[var(--text-secondary)]">
                {path.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {pluralize(path.items.length, "course")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatDuration(totalMinutes * 60)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {pluralize(path._count.enrollments, "learner")}
              </span>
              <span>{pluralize(totalLessons, "lesson")}</span>
            </div>

            {!enrolled && path.items.length > 0 && (
              <form action={enrollInPathAction} className="mt-6">
                <input type="hidden" name="pathId" value={path.id} />
                <Button type="submit" variant="primary" size="lg">
                  Start this path
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  You&apos;ll be enrolled in all {path.items.length} courses.
                </p>
              </form>
            )}
          </div>

          {enrolled && (
            <div className="flex shrink-0 justify-center">
              <ProgressRing
                value={pathEnrollment!.progressPercent}
                size={150}
                strokeWidth={12}
                color={path.color}
              >
                <span className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                  {pathEnrollment!.progressPercent}%
                </span>
                <span className="mt-0.5 text-xs text-[var(--text-muted)]">
                  complete
                </span>
              </ProgressRing>
            </div>
          )}
        </div>
      </Card>

      {/* Course sequence */}
      <h2 className="mb-4 text-xl font-bold tracking-tight text-[var(--text-primary)]">
        Course sequence
      </h2>

      {path.items.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">
            No courses have been added to this path yet.
          </p>
        </Card>
      ) : (
        <ol className="relative space-y-4">
          {path.items.map((item, index) => {
            const enrollment = progressByCourse.get(item.courseId);
            const percent = enrollment?.progressPercent ?? 0;
            const done = percent >= 100;
            const isLast = index === path.items.length - 1;

            return (
              <li key={item.id} className="relative">
                {/* Connector rail between steps */}
                {!isLast && (
                  <span
                    className="absolute left-[27px] top-[60px] w-0.5 rounded-full"
                    style={{
                      height: "calc(100% - 44px)",
                      background: done
                        ? path.color
                        : "var(--border-subtle)",
                    }}
                    aria-hidden
                  />
                )}

                <Link
                  href={`/courses/${item.course.slug}`}
                  className="neu-interactive flex gap-5 rounded-[var(--radius-neu)] p-5"
                >
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                    style={
                      done
                        ? { background: path.color, color: "#fff" }
                        : {
                            background: "var(--surface-sunken)",
                            color: "var(--text-muted)",
                            boxShadow:
                              "inset 3px 3px 7px var(--shadow-dark), inset -3px -3px 7px var(--shadow-light)",
                          }
                    }
                  >
                    {done ? <CheckCircle2 className="h-6 w-6" /> : index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {item.course.title}
                      </h3>
                      {item.isRequired ? (
                        <Badge tone="accent">Required</Badge>
                      ) : (
                        <Badge tone="outline">Optional</Badge>
                      )}
                      {item.course.status !== "PUBLISHED" && (
                        <Badge tone="warning">{item.course.status}</Badge>
                      )}
                    </div>

                    {item.course.subtitle && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                        {item.course.subtitle}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {pluralize(item.course.lessonCount, "lesson")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(item.course.durationMinutes * 60)}
                      </span>
                      <span>{item.course.level}</span>
                    </div>

                    {enrollment && (
                      <Progress
                        value={percent}
                        size="sm"
                        color={path.color}
                        className="mt-3"
                      />
                    )}
                  </div>

                  {enrollment && !done && (
                    <span className="hidden shrink-0 items-center self-center text-[var(--accent)] sm:flex">
                      <PlayCircle className="h-6 w-6" />
                    </span>
                  )}
                  {!enrollment && (
                    <span className="hidden shrink-0 items-center self-center text-[var(--text-muted)] sm:flex">
                      <Circle className="h-5 w-5" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
        Curated by {path.createdBy.name}
      </p>
    </div>
  );
}
