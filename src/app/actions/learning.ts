"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertUser, canAccessCourseContent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { logActivity, notify } from "@/lib/notify";
import { parseAnswerMap } from "@/lib/json";
import {
  answerSchema,
  fieldErrors,
  noteSchema,
  questionSchema,
  reviewSchema,
} from "@/lib/validators";
import {
  recalcCourseProgress,
  recalcCourseRating,
  recalcPathProgress,
} from "@/lib/progress";
import { luminaConfig } from "~/lumina.config";

import type { ActionState } from "./auth";

export type { ActionState };

/* -------------------------------------------------------------------------- */
/* Enrollment                                                                  */
/* -------------------------------------------------------------------------- */

export async function enrollAction(formData: FormData): Promise<void> {
  const user = await assertUser();
  const courseId = String(formData.get("courseId") || "");
  if (!courseId) return;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, status: true, title: true },
  });
  if (!course || course.status !== "PUBLISHED") return;

  if (!luminaConfig.features.selfEnrollment) {
    // Self-enrollment off: only honour it if training was already assigned.
    const assigned = await db.assignment.findFirst({
      where: { userId: user.id, courseId },
      select: { id: true },
    });
    if (!assigned) return;
  }

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });

  if (!existing) {
    await db.$transaction([
      db.enrollment.create({
        data: { userId: user.id, courseId, source: "SELF" },
      }),
      db.course.update({
        where: { id: courseId },
        data: { enrollmentCount: { increment: 1 } },
      }),
    ]);

    await logActivity({
      userId: user.id,
      action: "course.enroll",
      entity: "course",
      entityId: courseId,
    });
  }

  // Send them to the first lesson rather than back to the marketing page.
  const firstLesson = await db.lesson.findFirst({
    where: { section: { courseId } },
    orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
    select: { id: true },
  });

  revalidatePath(`/courses/${course.slug}`);
  revalidatePath("/my-learning");
  redirect(
    firstLesson
      ? `/learn/${course.slug}/${firstLesson.id}`
      : `/courses/${course.slug}`
  );
}

export async function enrollInPathAction(formData: FormData): Promise<void> {
  const user = await assertUser();
  const pathId = String(formData.get("pathId") || "");
  if (!pathId) return;

  const path = await db.learningPath.findUnique({
    where: { id: pathId },
    select: {
      id: true,
      slug: true,
      isPublished: true,
      items: { select: { courseId: true } },
    },
  });
  if (!path || !path.isPublished) return;

  await db.pathEnrollment.upsert({
    where: { userId_pathId: { userId: user.id, pathId } },
    create: { userId: user.id, pathId },
    update: {},
  });

  // Enrolling in a path enrolls in every course it contains.
  for (const item of path.items) {
    const existing = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: item.courseId } },
      select: { id: true },
    });
    if (existing) continue;

    await db.$transaction([
      db.enrollment.create({
        data: { userId: user.id, courseId: item.courseId, source: "PATH" },
      }),
      db.course.update({
        where: { id: item.courseId },
        data: { enrollmentCount: { increment: 1 } },
      }),
    ]);
  }

  await recalcPathProgress(user.id, pathId);

  revalidatePath(`/paths/${path.slug}`);
  revalidatePath("/my-learning");
  redirect(`/paths/${path.slug}`);
}

/* -------------------------------------------------------------------------- */
/* Lesson progress                                                             */
/* -------------------------------------------------------------------------- */

export async function toggleLessonCompleteAction(
  formData: FormData
): Promise<void> {
  const user = await assertUser();
  const lessonId = String(formData.get("lessonId") || "");
  const completed = formData.get("completed") === "true";
  if (!lessonId) return;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { section: { select: { courseId: true, course: { select: { slug: true } } } } },
  });
  if (!lesson) return;

  const courseId = lesson.section.courseId;
  if (!(await canAccessCourseContent(user, courseId))) return;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (!enrollment) return;

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: {
      userId: user.id,
      lessonId,
      enrollmentId: enrollment.id,
      completed,
      completedAt: completed ? new Date() : null,
    },
    update: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { lastLessonId: lessonId, startedAt: new Date() },
  });

  await recalcCourseProgress(user.id, courseId);

  revalidatePath(`/learn/${lesson.section.course.slug}/${lessonId}`);
  revalidatePath("/my-learning");
  revalidatePath("/dashboard");
}

/**
 * Fire-and-forget watch-position ping from the video player. Auto-completes the
 * lesson once the learner passes the configured watch ratio.
 */
export async function recordWatchProgressAction(input: {
  lessonId: string;
  seconds: number;
  duration: number;
}): Promise<{ completed: boolean }> {
  const user = await assertUser();

  const lesson = await db.lesson.findUnique({
    where: { id: input.lessonId },
    select: { section: { select: { courseId: true } } },
  });
  if (!lesson) return { completed: false };

  const courseId = lesson.section.courseId;
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (!enrollment) return { completed: false };

  const ratio =
    input.duration > 0 ? input.seconds / input.duration : 0;
  const shouldComplete = ratio >= luminaConfig.learning.videoCompletionThreshold;

  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId: input.lessonId } },
    select: { completed: true },
  });

  // Never walk a completed lesson back to incomplete on a re-watch.
  const completed = existing?.completed || shouldComplete;

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: input.lessonId } },
    create: {
      userId: user.id,
      lessonId: input.lessonId,
      enrollmentId: enrollment.id,
      secondsWatched: Math.floor(input.seconds),
      completed,
      completedAt: completed ? new Date() : null,
    },
    update: {
      secondsWatched: Math.floor(input.seconds),
      completed,
      completedAt: completed ? new Date() : undefined,
    },
  });

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { lastLessonId: input.lessonId, startedAt: new Date() },
  });

  if (completed && !existing?.completed) {
    await recalcCourseProgress(user.id, courseId);
    return { completed: true };
  }

  return { completed: false };
}

/* -------------------------------------------------------------------------- */
/* Quizzes                                                                     */
/* -------------------------------------------------------------------------- */

export interface QuizResult {
  score: number;
  passed: boolean;
  attemptNo: number;
  correctByQuestion: Record<string, boolean>;
  correctOptionIds: Record<string, string[]>;
  explanations: Record<string, string | null>;
  error?: string;
}

export async function submitQuizAction(
  lessonId: string,
  answers: Record<string, string[]>
): Promise<QuizResult> {
  const user = await assertUser();

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      section: { select: { courseId: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          points: true,
          explanation: true,
          options: { select: { id: true, isCorrect: true } },
        },
      },
    },
  });

  const empty: QuizResult = {
    score: 0,
    passed: false,
    attemptNo: 0,
    correctByQuestion: {},
    correctOptionIds: {},
    explanations: {},
  };

  if (!lesson || lesson.questions.length === 0) {
    return { ...empty, error: "This quiz has no questions yet." };
  }

  const courseId = lesson.section.courseId;
  if (!(await canAccessCourseContent(user, courseId))) {
    return { ...empty, error: "Enroll in this course to take the quiz." };
  }

  const priorAttempts = await db.quizAttempt.count({
    where: { userId: user.id, lessonId },
  });
  const maxAttempts = luminaConfig.learning.quizMaxAttempts;
  if (maxAttempts > 0 && priorAttempts >= maxAttempts) {
    return {
      ...empty,
      attemptNo: priorAttempts,
      error: `You've used all ${maxAttempts} attempts for this quiz.`,
    };
  }

  // Grade server-side — the correct answers are never sent to the browser
  // before submission.
  let earned = 0;
  let possible = 0;
  const correctByQuestion: Record<string, boolean> = {};
  const correctOptionIds: Record<string, string[]> = {};
  const explanations: Record<string, string | null> = {};

  for (const question of lesson.questions) {
    possible += question.points;
    const correctIds = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort();
    correctOptionIds[question.id] = correctIds;
    explanations[question.id] = question.explanation;

    const given = (answers[question.id] ?? []).slice().sort();
    const isCorrect =
      given.length === correctIds.length &&
      given.every((id, i) => id === correctIds[i]);

    correctByQuestion[question.id] = isCorrect;
    if (isCorrect) earned += question.points;
  }

  const score = possible ? Math.round((earned / possible) * 100) : 0;
  const passed = score >= luminaConfig.learning.quizPassingScore;
  const attemptNo = priorAttempts + 1;

  await db.quizAttempt.create({
    data: {
      userId: user.id,
      lessonId,
      score,
      passed,
      attemptNo,
      answers: JSON.stringify(answers),
    },
  });

  if (passed) {
    const enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });
    if (enrollment) {
      await db.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.id, lessonId } },
        create: {
          userId: user.id,
          lessonId,
          enrollmentId: enrollment.id,
          completed: true,
          completedAt: new Date(),
        },
        update: { completed: true, completedAt: new Date() },
      });
      await recalcCourseProgress(user.id, courseId);
    }
  }

  revalidatePath("/my-learning");
  return { score, passed, attemptNo, correctByQuestion, correctOptionIds, explanations };
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                       */
/* -------------------------------------------------------------------------- */

export async function saveNoteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await assertUser();

  const parsed = noteSchema.safeParse({
    lessonId: formData.get("lessonId"),
    body: formData.get("body"),
    timestampSeconds: formData.get("timestampSeconds") ?? 0,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const lesson = await db.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: { section: { select: { courseId: true } } },
  });
  if (!lesson) return { errors: { _form: "Lesson not found." } };
  if (!(await canAccessCourseContent(user, lesson.section.courseId))) {
    return { errors: { _form: "You don't have access to this lesson." } };
  }

  await db.note.create({
    data: {
      userId: user.id,
      lessonId: parsed.data.lessonId,
      body: parsed.data.body,
      timestampSeconds: parsed.data.timestampSeconds,
    },
  });

  revalidatePath("/learn", "layout");
  return { ok: true, message: "Note saved." };
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const user = await assertUser();
  const noteId = String(formData.get("noteId") || "");
  if (!noteId) return;

  // Scoped delete — a user can only remove their own notes.
  await db.note.deleteMany({ where: { id: noteId, userId: user.id } });
  revalidatePath("/learn", "layout");
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveReviewAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!luminaConfig.features.reviews) {
    return { errors: { _form: "Reviews are disabled." } };
  }
  const user = await assertUser();

  const parsed = reviewSchema.safeParse({
    courseId: formData.get("courseId"),
    rating: formData.get("rating"),
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Only people who actually took the course may rate it.
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: user.id, courseId: parsed.data.courseId },
    },
    select: { id: true },
  });
  if (!enrollment) {
    return { errors: { _form: "Enroll in this course before reviewing it." } };
  }

  await db.review.upsert({
    where: {
      userId_courseId: { userId: user.id, courseId: parsed.data.courseId },
    },
    create: {
      userId: user.id,
      courseId: parsed.data.courseId,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
    update: {
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
  });

  await recalcCourseRating(parsed.data.courseId);

  const course = await db.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { slug: true, instructorId: true, title: true },
  });

  if (course && course.instructorId !== user.id) {
    await notify({
      userId: course.instructorId,
      type: "REVIEW",
      title: `New ${parsed.data.rating}-star review`,
      body: `${user.name} reviewed "${course.title}".`,
      link: `/courses/${course.slug}`,
    });
  }

  if (course) revalidatePath(`/courses/${course.slug}`);
  return { ok: true, message: "Thanks for the feedback." };
}

/* -------------------------------------------------------------------------- */
/* Q&A                                                                         */
/* -------------------------------------------------------------------------- */

export async function askQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!luminaConfig.features.discussions) {
    return { errors: { _form: "Discussions are disabled." } };
  }
  const user = await assertUser();

  const parsed = questionSchema.safeParse({
    courseId: formData.get("courseId"),
    lessonId: formData.get("lessonId") ?? "",
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (!(await canAccessCourseContent(user, parsed.data.courseId))) {
    return { errors: { _form: "Enroll in this course to ask questions." } };
  }

  await db.question.create({
    data: {
      userId: user.id,
      courseId: parsed.data.courseId,
      lessonId: parsed.data.lessonId || null,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });

  const course = await db.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { slug: true, instructorId: true, title: true },
  });

  if (course && course.instructorId !== user.id) {
    await notify({
      userId: course.instructorId,
      type: "ANSWER",
      title: "New question on your course",
      body: `${user.name} asked: ${parsed.data.title}`,
      link: `/courses/${course.slug}#qa`,
    });
  }

  revalidatePath("/learn", "layout");
  if (course) revalidatePath(`/courses/${course.slug}`);
  return { ok: true, message: "Question posted." };
}

export async function answerQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await assertUser();

  const parsed = answerSchema.safeParse({
    questionId: formData.get("questionId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const question = await db.question.findUnique({
    where: { id: parsed.data.questionId },
    select: {
      userId: true,
      title: true,
      course: { select: { id: true, slug: true } },
    },
  });
  if (!question) return { errors: { _form: "Question not found." } };

  if (!(await canAccessCourseContent(user, question.course.id))) {
    return { errors: { _form: "You don't have access to this discussion." } };
  }

  await db.answer.create({
    data: {
      questionId: parsed.data.questionId,
      userId: user.id,
      body: parsed.data.body,
    },
  });

  if (question.userId !== user.id) {
    await notify({
      userId: question.userId,
      type: "ANSWER",
      title: "Someone answered your question",
      body: `${user.name} replied to "${question.title}".`,
      link: `/courses/${question.course.slug}#qa`,
    });
  }

  revalidatePath("/learn", "layout");
  revalidatePath(`/courses/${question.course.slug}`);
  return { ok: true, message: "Answer posted." };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export async function markNotificationsReadAction(): Promise<void> {
  const user = await assertUser();
  await db.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(
  formData: FormData
): Promise<void> {
  const user = await assertUser();
  const id = String(formData.get("notificationId") || "");
  if (!id) return;
  await db.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

/** Re-exported for the quiz UI, which needs to read a stored attempt. */
export async function getLatestQuizAttemptAction(lessonId: string) {
  const user = await assertUser();
  const attempt = await db.quizAttempt.findFirst({
    where: { userId: user.id, lessonId },
    orderBy: { createdAt: "desc" },
  });
  if (!attempt) return null;
  return {
    score: attempt.score,
    passed: attempt.passed,
    attemptNo: attempt.attemptNo,
    answers: parseAnswerMap(attempt.answers),
  };
}
