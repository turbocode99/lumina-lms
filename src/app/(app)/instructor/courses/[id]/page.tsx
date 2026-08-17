import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  Globe,
  ImageIcon,
  Layers,
  Settings,
  Star,
  Trash2,
  Users,
} from "lucide-react";

import { CourseForm } from "@/components/instructor/CourseForm";
import { CurriculumBuilder } from "@/components/instructor/CurriculumBuilder";
import { CourseMediaPanel } from "@/components/instructor/CourseMediaPanel";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import {
  deleteCourseAction,
  setCourseStatusAction,
} from "@/app/actions/authoring";
import { db } from "@/lib/db";
import { requireCourseEditor } from "@/lib/rbac";
import { parseStringArray } from "@/lib/json";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: course ? `Edit — ${course.title}` : "Edit course" };
}

export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Page-context guard: denies gracefully rather than throwing a 500, and 404s
  // when the course simply does not exist.
  const user = await requireCourseEditor(id);

  const [course, categories] = await Promise.all([
    db.course.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                questions: {
                  orderBy: { order: "asc" },
                  include: { options: { orderBy: { order: "asc" } } },
                },
              },
            },
          },
        },
        _count: { select: { enrollments: true, reviews: true } },
      },
    }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!course) notFound();

  const completions = await db.enrollment.count({
    where: { courseId: course.id, completedAt: { not: null } },
  });

  const totalLessons = course.sections.reduce(
    (acc, s) => acc + s.lessons.length,
    0
  );
  const canPublish = totalLessons > 0;

  const formValues = {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle ?? "",
    description: course.description ?? "",
    categoryId: course.categoryId ?? "",
    level: course.level,
    language: course.language,
    objectives: parseStringArray(course.objectives).join("\n"),
    requirements: parseStringArray(course.requirements).join("\n"),
    audience: parseStringArray(course.audience).join("\n"),
    tags: parseStringArray(course.tags).join(", "),
    isMandatory: course.isMandatory,
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <Link
        href="/instructor"
        className="neu-interactive inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my courses
      </Link>

      {/* Header + publish controls */}
      <Card elevation="lg">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={course.status} />
              {course.isMandatory && <Badge tone="danger">Required</Badge>}
              <Badge tone="outline">{course.level}</Badge>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {course.title}
            </h1>
            {course.subtitle && (
              <p className="mt-1.5 text-[var(--text-secondary)]">
                {course.subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/courses/${course.slug}`}>
              <Eye className="h-4 w-4" />
              Preview
            </ButtonLink>

            {course.status === "PUBLISHED" ? (
              <form action={setCourseStatusAction}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="status" value="DRAFT" />
                <Button type="submit">Unpublish</Button>
              </form>
            ) : (
              <form action={setCourseStatusAction}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="status" value="PUBLISHED" />
                <Button type="submit" variant="primary" disabled={!canPublish}>
                  <Globe className="h-4 w-4" />
                  Publish
                </Button>
              </form>
            )}
          </div>
        </div>

        {!canPublish && (
          <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] p-4 text-sm text-[var(--warning)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Add at least one lesson before publishing — learners shouldn&apos;t be
            able to enroll into an empty course.
          </p>
        )}
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lessons"
          value={totalLessons}
          icon={<BookOpen className="h-5 w-5" />}
        />
        <StatCard
          label="Run time"
          value={formatDuration(course.durationMinutes * 60)}
          icon={<Layers className="h-5 w-5" />}
          accent="var(--info)"
        />
        <StatCard
          label="Enrolled"
          value={course._count.enrollments}
          icon={<Users className="h-5 w-5" />}
          accent="var(--secondary)"
          trend={{ value: `${completions} completed` }}
        />
        <StatCard
          label="Rating"
          value={course.ratingCount > 0 ? course.ratingAvg.toFixed(1) : "—"}
          icon={<Star className="h-5 w-5" />}
          accent="var(--warning)"
          trend={{ value: `${course._count.reviews} reviews` }}
        />
      </div>

      <Tabs
        defaultTab="curriculum"
        items={[
          {
            id: "curriculum",
            label: "Curriculum",
            icon: <Layers className="h-4 w-4" />,
            count: totalLessons,
            content: (
              <CurriculumBuilder courseId={course.id} sections={course.sections} />
            ),
          },
          {
            id: "details",
            label: "Details",
            icon: <Settings className="h-4 w-4" />,
            content: (
              <Card>
                <CourseForm
                  values={formValues}
                  categories={categories}
                  canSetMandatory={user.role === "ADMIN"}
                  mode="edit"
                />
              </Card>
            ),
          },
          {
            id: "media",
            label: "Media",
            icon: <ImageIcon className="h-4 w-4" />,
            content: (
              <CourseMediaPanel
                courseId={course.id}
                thumbnailUrl={course.thumbnailUrl}
              />
            ),
          },
          {
            id: "danger",
            label: "Danger zone",
            icon: <Archive className="h-4 w-4" />,
            content: (
              <div className="space-y-5">
                <Card>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    Archive this course
                  </h3>
                  <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                    Removes it from the catalog. Existing enrollments and progress
                    are kept, and you can restore it by publishing again.
                  </p>
                  <form action={setCourseStatusAction} className="mt-4">
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="status" value="ARCHIVED" />
                    <Button
                      type="submit"
                      disabled={course.status === "ARCHIVED"}
                    >
                      <Archive className="h-4 w-4" />
                      {course.status === "ARCHIVED" ? "Archived" : "Archive course"}
                    </Button>
                  </form>
                </Card>

                <Card className="ring-1 ring-[color-mix(in_srgb,var(--danger)_30%,transparent)]">
                  <h3 className="font-semibold text-[var(--danger)]">
                    Delete this course
                  </h3>
                  <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                    Permanently removes the course along with every section,
                    lesson, enrollment, review, and progress record. This cannot
                    be undone.
                    {course._count.enrollments > 0 && (
                      <>
                        {" "}
                        <strong className="text-[var(--danger)]">
                          {course._count.enrollments} learner
                          {course._count.enrollments === 1 ? " is" : "s are"}{" "}
                          currently enrolled.
                        </strong>
                      </>
                    )}
                  </p>
                  <form action={deleteCourseAction} className="mt-4">
                    <input type="hidden" name="courseId" value={course.id} />
                    <Button type="submit" variant="danger">
                      <Trash2 className="h-4 w-4" />
                      Delete permanently
                    </Button>
                  </form>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
