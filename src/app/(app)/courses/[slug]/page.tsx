import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Globe,
  GraduationCap,
  PenSquare,
  PlayCircle,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";

import { Curriculum } from "@/components/course/Curriculum";
import { QASection } from "@/components/course/QASection";
import { ReviewSection } from "@/components/course/ReviewSection";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Rating } from "@/components/ui/Rating";
import { Tabs } from "@/components/ui/Tabs";
import { enrollAction } from "@/app/actions/learning";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { parseStringArray } from "@/lib/json";
import { formatDuration, pluralize } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: { title: true, subtitle: true },
  });
  return {
    title: course?.title ?? "Course",
    description: course?.subtitle ?? undefined,
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser(`/courses/${slug}`);

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          title: true,
          headline: true,
          bio: true,
          _count: { select: { coursesAuthored: true } },
        },
      },
      category: { select: { id: true, name: true, color: true } },
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              durationSeconds: true,
              isPreview: true,
            },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, avatarUrl: true, title: true } },
        },
      },
      questions: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          answers: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const isOwner = course.instructorId === user.id;
  const isAdmin = user.role === "ADMIN";

  // Unpublished courses are visible only to their author and admins.
  if (course.status !== "PUBLISHED" && !isOwner && !isAdmin) notFound();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true, progressPercent: true, lastLessonId: true },
  });

  const hasAccess = Boolean(enrollment) || isOwner || isAdmin;

  const completedLessonIds = enrollment
    ? new Set(
        (
          await db.lessonProgress.findMany({
            where: { userId: user.id, enrollmentId: enrollment.id, completed: true },
            select: { lessonId: true },
          })
        ).map((p) => p.lessonId)
      )
    : new Set<string>();

  const sections = course.sections.map((section) => ({
    id: section.id,
    title: section.title,
    lessons: section.lessons.map((lesson) => ({
      ...lesson,
      completed: completedLessonIds.has(lesson.id),
    })),
  }));

  const allLessons = sections.flatMap((s) => s.lessons);
  const firstLesson = allLessons[0];
  const resumeLessonId =
    enrollment?.lastLessonId ??
    allLessons.find((l) => !l.completed)?.id ??
    firstLesson?.id;

  const objectives = parseStringArray(course.objectives);
  const requirements = parseStringArray(course.requirements);
  const audience = parseStringArray(course.audience);
  const tags = parseStringArray(course.tags);

  const myReview = course.reviews.find((r) => r.userId === user.id) ?? null;

  const accent = course.category?.color ?? "var(--accent)";

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: <Target className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          {objectives.length > 0 && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                What you&apos;ll learn
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {objectives.map((objective, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                    <span className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      {objective}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {course.description && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                About this course
              </h2>
              <div className="prose-lumina whitespace-pre-wrap text-sm">
                {course.description}
              </div>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {requirements.length > 0 && (
              <Card>
                <h2 className="mb-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                  Requirements
                </h2>
                <ul className="space-y-2.5">
                  {requirements.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {audience.length > 0 && (
              <Card>
                <h2 className="mb-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                  Who this is for
                </h2>
                <ul className="space-y-2.5">
                  {audience.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]"
                    >
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* Instructor */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Instructor
            </h2>
            <div className="flex gap-5">
              <Avatar
                name={course.instructor.name}
                src={course.instructor.avatarUrl}
                size="xl"
              />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {course.instructor.name}
                </p>
                {(course.instructor.headline || course.instructor.title) && (
                  <p className="mt-0.5 text-sm text-[var(--accent)]">
                    {course.instructor.headline ?? course.instructor.title}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <BookOpen className="h-3.5 w-3.5" />
                  {pluralize(course.instructor._count.coursesAuthored, "course")}
                </p>
                {course.instructor.bio && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                    {course.instructor.bio}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {tags.length > 0 && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                Topics
              </h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/catalog?q=${encodeURIComponent(tag)}`}
                    className="neu-sm rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      ),
    },
    {
      id: "curriculum",
      label: "Curriculum",
      icon: <BookOpen className="h-4 w-4" />,
      count: allLessons.length,
      content:
        sections.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              The curriculum for this course hasn&apos;t been published yet.
            </p>
          </Card>
        ) : (
          <Curriculum
            sections={sections}
            courseSlug={course.slug}
            hasAccess={hasAccess}
          />
        ),
    },
  ];

  if (luminaConfig.features.reviews) {
    tabs.push({
      id: "reviews",
      label: "Reviews",
      icon: <BarChart3 className="h-4 w-4" />,
      count: course.reviews.length,
      content: (
        <ReviewSection
          courseId={course.id}
          reviews={course.reviews}
          ratingAvg={course.ratingAvg}
          ratingCount={course.ratingCount}
          canReview={Boolean(enrollment)}
          myReview={myReview}
        />
      ),
    });
  }

  if (luminaConfig.features.discussions) {
    tabs.push({
      id: "qa",
      label: "Q&A",
      icon: <Users className="h-4 w-4" />,
      count: course.questions.length,
      content: (
        <QASection
          courseId={course.id}
          questions={course.questions}
          canPost={hasAccess}
          instructorId={course.instructorId}
        />
      ),
    });
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Hero */}
      <section className="neu mb-8 overflow-hidden rounded-[var(--radius-neu-lg)]">
        <div className="grid gap-0 lg:grid-cols-[1fr_400px]">
          <div className="p-7 sm:p-9">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {course.category && (
                <Link
                  href={`/catalog?category=${course.category.id}`}
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-opacity hover:opacity-80"
                  style={{
                    color: course.category.color,
                    background: `color-mix(in srgb, ${course.category.color} 14%, transparent)`,
                  }}
                >
                  {course.category.name}
                </Link>
              )}
              <Badge tone="outline">{course.level}</Badge>
              {course.isMandatory && (
                <Badge tone="danger" icon={<ShieldAlert className="h-3 w-3" />}>
                  Required training
                </Badge>
              )}
              {course.status !== "PUBLISHED" && (
                <Badge tone="warning">{course.status}</Badge>
              )}
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {course.title}
            </h1>

            {course.subtitle && (
              <p className="mt-3 text-lg leading-relaxed text-[var(--text-secondary)]">
                {course.subtitle}
              </p>
            )}

            <div
              data-tour="course-meta"
              className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--text-muted)]"
            >
              {course.ratingCount > 0 && (
                <Rating value={course.ratingAvg} count={course.ratingCount} />
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {pluralize(course.enrollmentCount, "learner")}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {pluralize(allLessons.length, "lesson")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatDuration(course.durationMinutes * 60)}
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                {course.language}
              </span>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Avatar
                name={course.instructor.name}
                src={course.instructor.avatarUrl}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {course.instructor.name}
                </p>
                {course.instructor.title && (
                  <p className="text-xs text-[var(--text-muted)]">
                    {course.instructor.title}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action panel */}
          <aside
            data-tour="course-enroll"
            className="border-t border-[var(--border-subtle)] p-7 sm:p-9 lg:border-l lg:border-t-0"
          >
            <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-2xl">
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
                    background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 45%, var(--secondary)))`,
                  }}
                >
                  <GraduationCap className="h-12 w-12 text-white/70" />
                </div>
              )}
            </div>

            {enrollment ? (
              <>
                <Progress
                  value={enrollment.progressPercent}
                  showLabel
                  label={
                    enrollment.progressPercent >= 100
                      ? "Completed"
                      : "Your progress"
                  }
                  className="mb-5"
                />
                {resumeLessonId && (
                  <ButtonLink
                    href={`/learn/${course.slug}/${resumeLessonId}`}
                    variant="primary"
                    size="lg"
                    fullWidth
                  >
                    <PlayCircle className="h-5 w-5" />
                    {enrollment.progressPercent > 0
                      ? "Continue course"
                      : "Start course"}
                  </ButtonLink>
                )}
              </>
            ) : allLessons.length === 0 ? (
              <p className="rounded-2xl bg-[var(--surface-sunken)] p-4 text-center text-sm text-[var(--text-muted)]">
                This course has no lessons yet.
              </p>
            ) : luminaConfig.features.selfEnrollment ? (
              <form action={enrollAction}>
                <input type="hidden" name="courseId" value={course.id} />
                <Button type="submit" variant="primary" size="lg" fullWidth>
                  Enroll now
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </form>
            ) : (
              <p className="rounded-2xl bg-[var(--surface-sunken)] p-4 text-center text-sm text-[var(--text-muted)]">
                Enrollment is managed by your learning administrator.
              </p>
            )}

            {(isOwner || isAdmin) && (
              <ButtonLink
                href={`/instructor/courses/${course.id}`}
                fullWidth
                className="mt-3"
              >
                <PenSquare className="h-4 w-4" />
                Edit course
              </ButtonLink>
            )}

            <ul className="mt-6 space-y-2.5 border-t border-[var(--border-subtle)] pt-5 text-sm text-[var(--text-secondary)]">
              <li className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                {formatDuration(course.durationMinutes * 60)} of content
              </li>
              <li className="flex items-center gap-2.5">
                <BookOpen className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                {pluralize(allLessons.length, "lesson")} across{" "}
                {pluralize(sections.length, "section")}
              </li>
              {luminaConfig.features.certificates && (
                <li className="flex items-center gap-2.5">
                  <GraduationCap className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  Certificate on completion
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <BarChart3 className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                {course.level}
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <div data-tour="course-tabs">
        <Tabs items={tabs} />
      </div>
    </div>
  );
}
