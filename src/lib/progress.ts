import "server-only";

import { db } from "@/lib/db";
import { luminaConfig } from "~/lumina.config";
import { notify } from "@/lib/notify";

/**
 * Progress is denormalised onto Enrollment/PathEnrollment so the dashboard and
 * catalog can render without walking every lesson row. These functions are the
 * only writers of those fields — call `recalcCourseProgress` after any change to
 * lesson completion, and it cascades to paths, assignments, and certificates.
 */

/** Refreshes an enrollment's percent, completion date, certificate, and paths. */
export async function recalcCourseProgress(
  userId: string,
  courseId: string
): Promise<{ percent: number; completed: boolean }> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, completedAt: true },
  });
  if (!enrollment) return { percent: 0, completed: false };

  const lessons = await db.lesson.findMany({
    where: { section: { courseId } },
    select: { id: true },
  });
  const total = lessons.length;

  const completedCount = total
    ? await db.lessonProgress.count({
        where: {
          userId,
          completed: true,
          lessonId: { in: lessons.map((l) => l.id) },
        },
      })
    : 0;

  const percent = total ? Math.round((completedCount / total) * 100) : 0;
  const justCompleted = percent >= 100 && !enrollment.completedAt;

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progressPercent: percent,
      completedAt: percent >= 100 ? enrollment.completedAt ?? new Date() : null,
    },
  });

  if (justCompleted) {
    await onCourseCompleted(userId, courseId);
  }

  // A course can belong to several paths; refresh each one the learner is on.
  const pathIds = await db.pathItem.findMany({
    where: { courseId },
    select: { pathId: true },
  });
  for (const { pathId } of pathIds) {
    await recalcPathProgress(userId, pathId);
  }

  return { percent, completed: percent >= 100 };
}

async function onCourseCompleted(userId: string, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { title: true, slug: true },
  });
  if (!course) return;

  // Close out any mandatory-training assignment for this course.
  await db.assignment.updateMany({
    where: { userId, courseId, completedAt: null },
    data: { completedAt: new Date() },
  });

  if (luminaConfig.features.certificates) {
    await issueCertificate({
      userId,
      courseId,
      title: course.title,
    });
  }

  await notify({
    userId,
    type: "CERTIFICATE",
    title: `Course complete — ${course.title}`,
    body: luminaConfig.features.certificates
      ? "Your certificate is ready to download."
      : "Nice work finishing this course.",
    link: luminaConfig.features.certificates
      ? "/certificates"
      : `/courses/${course.slug}`,
  });
}

export async function recalcPathProgress(
  userId: string,
  pathId: string
): Promise<number> {
  const enrollment = await db.pathEnrollment.findUnique({
    where: { userId_pathId: { userId, pathId } },
    select: { id: true, completedAt: true },
  });
  if (!enrollment) return 0;

  const items = await db.pathItem.findMany({
    where: { pathId },
    select: { courseId: true, isRequired: true },
  });
  // Optional items count toward the bar but never block completion.
  const required = items.filter((i) => i.isRequired);
  const scope = required.length ? required : items;
  if (!scope.length) return 0;

  const enrollments = await db.enrollment.findMany({
    where: { userId, courseId: { in: scope.map((i) => i.courseId) } },
    select: { progressPercent: true },
  });

  const sum = enrollments.reduce((acc, e) => acc + e.progressPercent, 0);
  const percent = Math.round(sum / scope.length);
  const justCompleted = percent >= 100 && !enrollment.completedAt;

  await db.pathEnrollment.update({
    where: { id: enrollment.id },
    data: {
      progressPercent: percent,
      completedAt: percent >= 100 ? enrollment.completedAt ?? new Date() : null,
    },
  });

  if (justCompleted) {
    const path = await db.learningPath.findUnique({
      where: { id: pathId },
      select: { title: true },
    });
    await db.assignment.updateMany({
      where: { userId, pathId, completedAt: null },
      data: { completedAt: new Date() },
    });
    if (path && luminaConfig.features.certificates) {
      await issueCertificate({ userId, pathId, title: path.title });
    }
    if (path) {
      await notify({
        userId,
        type: "CERTIFICATE",
        title: `Learning path complete — ${path.title}`,
        body: "Every required course in this path is done.",
        link: "/certificates",
      });
    }
  }

  return percent;
}

/** Idempotent — re-running after a re-completion won't mint a duplicate. */
export async function issueCertificate(input: {
  userId: string;
  courseId?: string;
  pathId?: string;
  title: string;
}): Promise<void> {
  const existing = await db.certificate.findFirst({
    where: {
      userId: input.userId,
      courseId: input.courseId ?? null,
      pathId: input.pathId ?? null,
    },
    select: { id: true },
  });
  if (existing) return;

  await db.certificate.create({
    data: {
      userId: input.userId,
      courseId: input.courseId ?? null,
      pathId: input.pathId ?? null,
      title: input.title,
      serial: generateSerial(),
    },
  });
}

function generateSerial(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from(
      { length: 4 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
  return `LUM-${block()}-${block()}-${block()}`;
}

/** Rolls up denormalised counters after curriculum edits. */
export async function recalcCourseStats(courseId: string): Promise<void> {
  const lessons = await db.lesson.findMany({
    where: { section: { courseId } },
    select: { durationSeconds: true },
  });
  const totalSeconds = lessons.reduce((acc, l) => acc + l.durationSeconds, 0);

  await db.course.update({
    where: { id: courseId },
    data: {
      lessonCount: lessons.length,
      durationMinutes: Math.round(totalSeconds / 60),
    },
  });
}

/** Recomputes the cached rating average after a review is written or removed. */
export async function recalcCourseRating(courseId: string): Promise<void> {
  const agg = await db.review.aggregate({
    where: { courseId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await db.course.update({
    where: { id: courseId },
    data: {
      ratingAvg: Number((agg._avg.rating ?? 0).toFixed(2)),
      ratingCount: agg._count.rating,
    },
  });
}
