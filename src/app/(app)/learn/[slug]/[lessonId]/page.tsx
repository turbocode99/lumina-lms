import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ListChecks,
  MessageCircleQuestion,
  NotebookPen,
  Paperclip,
} from "lucide-react";

import { Curriculum } from "@/components/course/Curriculum";
import { QASection } from "@/components/course/QASection";
import { LessonCompleteToggle } from "@/components/player/LessonComplete";
import { NotesPanel } from "@/components/player/NotesPanel";
import { Quiz } from "@/components/player/Quiz";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Tabs } from "@/components/ui/Tabs";
import { db } from "@/lib/db";
import { canAccessCourseContent, requireUser } from "@/lib/rbac";
import { formatDuration } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { title: true },
  });
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const user = await requireUser(`/learn/${slug}/${lessonId}`);

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { id: true, name: true, avatarUrl: true } },
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
    },
  });

  if (!course) notFound();

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: { select: { courseId: true, title: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          prompt: true,
          type: true,
          points: true,
          options: {
            orderBy: { order: "asc" },
            // `isCorrect` is deliberately excluded — the answer key must not
            // reach the browser before the learner submits.
            select: { id: true, text: true },
          },
        },
      },
    },
  });

  if (!lesson || lesson.section.courseId !== course.id) notFound();

  const hasAccess = await canAccessCourseContent(user, course.id);

  // Preview lessons stay open to everyone; anything else needs enrollment.
  if (!hasAccess && !lesson.isPreview) {
    redirect(`/courses/${slug}`);
  }

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true, progressPercent: true },
  });

  const [progressRows, notes, quizAttempts, discussions] = await Promise.all([
    enrollment
      ? db.lessonProgress.findMany({
          where: { userId: user.id, enrollmentId: enrollment.id },
          select: { lessonId: true, completed: true },
        })
      : Promise.resolve([]),

    luminaConfig.features.notes
      ? db.note.findMany({
          where: { userId: user.id, lessonId },
          orderBy: { createdAt: "desc" },
          select: { id: true, body: true, timestampSeconds: true, createdAt: true },
        })
      : Promise.resolve([]),

    lesson.type === "QUIZ"
      ? db.quizAttempt.findMany({
          where: { userId: user.id, lessonId },
          orderBy: { createdAt: "desc" },
          select: { score: true, passed: true },
        })
      : Promise.resolve([]),

    luminaConfig.features.discussions
      ? db.question.findMany({
          where: { courseId: course.id, lessonId },
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
        })
      : Promise.resolve([]),
  ]);

  const completedIds = new Set(
    progressRows.filter((p) => p.completed).map((p) => p.lessonId)
  );

  const sections = course.sections.map((section) => ({
    id: section.id,
    title: section.title,
    lessons: section.lessons.map((l) => ({
      ...l,
      completed: completedIds.has(l.id),
    })),
  }));

  // Flatten for prev/next navigation across section boundaries.
  const flatLessons = sections.flatMap((s) => s.lessons);
  const index = flatLessons.findIndex((l) => l.id === lessonId);
  const previous = index > 0 ? flatLessons[index - 1] : null;
  const next = index < flatLessons.length - 1 ? flatLessons[index + 1] : null;

  const isComplete = completedIds.has(lessonId);
  const bestScore = quizAttempts.length
    ? Math.max(...quizAttempts.map((a) => a.score))
    : null;
  const passedQuiz = quizAttempts.some((a) => a.passed);

  const sidePanels = [];

  if (luminaConfig.features.notes && hasAccess) {
    sidePanels.push({
      id: "notes",
      label: "Notes",
      icon: <NotebookPen className="h-4 w-4" />,
      count: notes.length,
      content: (
        <NotesPanel
          lessonId={lessonId}
          notes={notes}
          isVideo={lesson.type === "VIDEO"}
        />
      ),
    });
  }

  if (luminaConfig.features.discussions) {
    sidePanels.push({
      id: "qa",
      label: "Q&A",
      icon: <MessageCircleQuestion className="h-4 w-4" />,
      count: discussions.length,
      content: (
        <QASection
          courseId={course.id}
          lessonId={lessonId}
          questions={discussions}
          canPost={hasAccess}
          instructorId={course.instructorId}
        />
      ),
    });
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Breadcrumb bar */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Link
          href={`/courses/${course.slug}`}
          className="neu-interactive flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)]"
          aria-label="Back to course"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/courses/${course.slug}`}
            className="truncate text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            {course.title}
          </Link>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {lesson.section.title}
          </p>
        </div>

        {enrollment && (
          <div className="w-full sm:w-56">
            <Progress
              value={enrollment.progressPercent}
              size="sm"
              showLabel
              label="Course progress"
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Main column */}
        <div data-tour="player-main" className="min-w-0 space-y-6">
          {/* Lesson body */}
          {lesson.type === "VIDEO" && lesson.contentUrl ? (
            <VideoPlayer
              src={lesson.contentUrl}
              lessonId={lessonId}
              poster={course.thumbnailUrl}
            />
          ) : lesson.type === "QUIZ" ? (
            <Quiz
              lessonId={lessonId}
              questions={lesson.questions}
              priorAttempts={quizAttempts.length}
              bestScore={bestScore}
              alreadyPassed={passedQuiz}
            />
          ) : lesson.type === "RESOURCE" ? (
            <Card>
              <div className="flex flex-col items-center py-10 text-center">
                <span className="neu-inset mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-[var(--accent)]">
                  <Paperclip className="h-7 w-7" />
                </span>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {lesson.title}
                </h2>
                {lesson.summary && (
                  <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
                    {lesson.summary}
                  </p>
                )}
                {lesson.contentUrl && (
                  <ButtonLink
                    href={lesson.contentUrl}
                    variant="primary"
                    className="mt-6"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4" />
                    Download resource
                  </ButtonLink>
                )}
              </div>
            </Card>
          ) : lesson.type === "VIDEO" ? (
            <Card>
              <p className="py-16 text-center text-sm text-[var(--text-muted)]">
                No video has been uploaded for this lesson yet.
              </p>
            </Card>
          ) : null}

          {/* Article body */}
          {lesson.type === "ARTICLE" && (
            <Card>
              <div className="mb-5 flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-[var(--accent)]" />
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  {lesson.title}
                </h1>
              </div>
              {lesson.contentText ? (
                <div className="prose-lumina whitespace-pre-wrap">
                  {lesson.contentText}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  This lesson has no content yet.
                </p>
              )}
            </Card>
          )}

          {/* Title + actions for non-article lessons */}
          {lesson.type !== "ARTICLE" && (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{lesson.type}</Badge>
                    {lesson.durationSeconds > 0 && (
                      <Badge tone="outline">
                        {formatDuration(lesson.durationSeconds)}
                      </Badge>
                    )}
                    {lesson.isPreview && <Badge tone="info">Preview</Badge>}
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                    {lesson.title}
                  </h1>
                  {lesson.summary && (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {lesson.summary}
                    </p>
                  )}
                </div>

                {/* Quizzes complete themselves on a pass — no manual toggle. */}
                {hasAccess && enrollment && lesson.type !== "QUIZ" && (
                  <LessonCompleteToggle
                    lessonId={lessonId}
                    completed={isComplete}
                  />
                )}
              </div>
            </Card>
          )}

          {lesson.type === "ARTICLE" && hasAccess && enrollment && (
            <div className="flex justify-end">
              <LessonCompleteToggle lessonId={lessonId} completed={isComplete} />
            </div>
          )}

          {/* Prev / next */}
          <div
            data-tour="player-next"
            className="flex items-center justify-between gap-4"
          >
            {previous ? (
              <Link
                href={`/learn/${course.slug}/${previous.id}`}
                className="neu-interactive flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-4 sm:max-w-xs"
              >
                <ChevronLeft className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                <span className="min-w-0">
                  <span className="block text-xs text-[var(--text-muted)]">
                    Previous
                  </span>
                  <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                    {previous.title}
                  </span>
                </span>
              </Link>
            ) : (
              <span />
            )}

            {next ? (
              <Link
                href={`/learn/${course.slug}/${next.id}`}
                className="neu-interactive flex min-w-0 flex-1 items-center justify-end gap-3 rounded-2xl p-4 text-right sm:max-w-xs"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-[var(--text-muted)]">
                    Next
                  </span>
                  <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                    {next.title}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--accent)]" />
              </Link>
            ) : (
              <Link
                href={`/courses/${course.slug}`}
                className="neu-accent flex items-center gap-2 rounded-2xl px-5 py-4 text-sm font-semibold"
              >
                Finish course
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {/* Notes + Q&A below the fold on narrow screens */}
          {sidePanels.length > 0 && (
            <div className="xl:hidden">
              <Tabs items={sidePanels} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-6">
          <Card padded={false} className="overflow-hidden" data-tour="player-curriculum">
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] p-5">
              <ListChecks className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Course content
              </h2>
              <span className="ml-auto text-xs text-[var(--text-muted)]">
                {completedIds.size}/{flatLessons.length}
              </span>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-3">
              <Curriculum
                sections={sections}
                courseSlug={course.slug}
                hasAccess={hasAccess}
                currentLessonId={lessonId}
                compact
              />
            </div>
          </Card>

          {sidePanels.length > 0 && (
            <div className="hidden xl:block" data-tour="player-panels">
              <Card>
                <Tabs items={sidePanels} />
              </Card>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
