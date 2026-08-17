"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  assertCanEditCourse,
  assertCanEditLesson,
  assertCanEditSection,
  assertRole,
} from "@/lib/rbac";
import { logActivity } from "@/lib/notify";
import { csvToArray, linesToArray, stringifyStringArray } from "@/lib/json";
import { recalcCourseStats } from "@/lib/progress";
import { uniqueSlug } from "@/lib/utils";
import {
  courseSchema,
  fieldErrors,
  lessonSchema,
  quizQuestionSchema,
  sectionSchema,
} from "@/lib/validators";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_RESOURCE_TYPES,
  ALLOWED_VIDEO_TYPES,
  keyFromUrl,
  maxUploadBytes,
  storage,
} from "@/lib/storage";

import type { ActionState } from "./auth";

export type { ActionState };

/* -------------------------------------------------------------------------- */
/* Courses                                                                     */
/* -------------------------------------------------------------------------- */

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await assertRole("INSTRUCTOR");

  const parsed = courseSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") ?? "",
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    level: formData.get("level") ?? "All Levels",
    language: formData.get("language") || "English",
    objectives: formData.get("objectives") ?? "",
    requirements: formData.get("requirements") ?? "",
    audience: formData.get("audience") ?? "",
    tags: formData.get("tags") ?? "",
    isMandatory: formData.get("isMandatory") === "on",
    thumbnailUrl: formData.get("thumbnailUrl") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Only admins may flag a course as org-wide required training.
  const isMandatory = user.role === "ADMIN" ? parsed.data.isMandatory : false;

  const slug = await uniqueSlug(parsed.data.title, async (candidate) =>
    Boolean(await db.course.findUnique({ where: { slug: candidate }, select: { id: true } }))
  );

  const course = await db.course.create({
    data: {
      slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      description: parsed.data.description || null,
      categoryId: parsed.data.categoryId || null,
      instructorId: user.id,
      level: parsed.data.level,
      language: parsed.data.language,
      objectives: stringifyStringArray(linesToArray(parsed.data.objectives)),
      requirements: stringifyStringArray(linesToArray(parsed.data.requirements)),
      audience: stringifyStringArray(linesToArray(parsed.data.audience)),
      tags: stringifyStringArray(csvToArray(parsed.data.tags)),
      isMandatory,
      thumbnailUrl: parsed.data.thumbnailUrl || null,
      status: "DRAFT",
    },
    select: { id: true },
  });

  await logActivity({
    userId: user.id,
    action: "course.create",
    entity: "course",
    entityId: course.id,
  });

  revalidatePath("/instructor");
  redirect(`/instructor/courses/${course.id}`);
}

export async function updateCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const courseId = String(formData.get("courseId") || "");
  if (!courseId) return { errors: { _form: "Missing course." } };

  const user = await assertCanEditCourse(courseId);

  const parsed = courseSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") ?? "",
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    level: formData.get("level") ?? "All Levels",
    language: formData.get("language") || "English",
    objectives: formData.get("objectives") ?? "",
    requirements: formData.get("requirements") ?? "",
    audience: formData.get("audience") ?? "",
    tags: formData.get("tags") ?? "",
    isMandatory: formData.get("isMandatory") === "on",
    // Not submitted by the edit form — the Media tab owns the thumbnail.
    thumbnailUrl: "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const existing = await db.course.findUnique({
    where: { id: courseId },
    select: { slug: true, title: true, isMandatory: true },
  });
  if (!existing) return { errors: { _form: "Course not found." } };

  // Keep the slug stable unless the title actually changed — links in chat and
  // email shouldn't break because someone fixed a typo.
  const slug =
    existing.title === parsed.data.title
      ? existing.slug
      : await uniqueSlug(parsed.data.title, async (candidate) =>
          Boolean(
            await db.course.findFirst({
              where: { slug: candidate, NOT: { id: courseId } },
              select: { id: true },
            })
          )
        );

  await db.course.update({
    where: { id: courseId },
    data: {
      slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      description: parsed.data.description || null,
      categoryId: parsed.data.categoryId || null,
      level: parsed.data.level,
      language: parsed.data.language,
      objectives: stringifyStringArray(linesToArray(parsed.data.objectives)),
      requirements: stringifyStringArray(linesToArray(parsed.data.requirements)),
      audience: stringifyStringArray(linesToArray(parsed.data.audience)),
      tags: stringifyStringArray(csvToArray(parsed.data.tags)),
      isMandatory:
        user.role === "ADMIN" ? parsed.data.isMandatory : existing.isMandatory,
    },
  });

  revalidatePath(`/instructor/courses/${courseId}`);
  revalidatePath(`/courses/${slug}`);
  return { ok: true, message: "Course saved." };
}

export async function setCourseStatusAction(formData: FormData): Promise<void> {
  const courseId = String(formData.get("courseId") || "");
  const status = String(formData.get("status") || "");
  if (!courseId || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return;

  const user = await assertCanEditCourse(courseId);

  // Refuse to publish an empty shell — learners would enroll into nothing.
  if (status === "PUBLISHED") {
    const lessonCount = await db.lesson.count({
      where: { section: { courseId } },
    });
    if (lessonCount === 0) return;
  }

  const course = await db.course.update({
    where: { id: courseId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
    select: { slug: true },
  });

  await logActivity({
    userId: user.id,
    action: `course.${status.toLowerCase()}`,
    entity: "course",
    entityId: courseId,
  });

  revalidatePath("/instructor");
  revalidatePath("/catalog");
  revalidatePath(`/instructor/courses/${courseId}`);
  revalidatePath(`/courses/${course.slug}`);
}

export async function deleteCourseAction(formData: FormData): Promise<void> {
  const courseId = String(formData.get("courseId") || "");
  if (!courseId) return;

  const user = await assertCanEditCourse(courseId);

  await logActivity({
    userId: user.id,
    action: "course.delete",
    entity: "course",
    entityId: courseId,
  });

  // Cascades take out sections, lessons, enrollments, and progress.
  await db.course.delete({ where: { id: courseId } });

  revalidatePath("/instructor");
  revalidatePath("/catalog");
  redirect("/instructor");
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

export async function createSectionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = sectionSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await assertCanEditCourse(parsed.data.courseId);

  const last = await db.section.findFirst({
    where: { courseId: parsed.data.courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.section.create({
    data: {
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath(`/instructor/courses/${parsed.data.courseId}`);
  return { ok: true, message: "Section added." };
}

export async function renameSectionAction(formData: FormData): Promise<void> {
  const sectionId = String(formData.get("sectionId") || "");
  const title = String(formData.get("title") || "").trim();
  if (!sectionId || title.length < 2) return;

  await assertCanEditSection(sectionId);

  const section = await db.section.update({
    where: { id: sectionId },
    data: { title: title.slice(0, 120) },
    select: { courseId: true },
  });

  revalidatePath(`/instructor/courses/${section.courseId}`);
}

export async function deleteSectionAction(formData: FormData): Promise<void> {
  const sectionId = String(formData.get("sectionId") || "");
  if (!sectionId) return;

  await assertCanEditSection(sectionId);

  const section = await db.section.delete({
    where: { id: sectionId },
    select: { courseId: true },
  });

  await recalcCourseStats(section.courseId);
  revalidatePath(`/instructor/courses/${section.courseId}`);
}

export async function moveSectionAction(formData: FormData): Promise<void> {
  const sectionId = String(formData.get("sectionId") || "");
  const direction = String(formData.get("direction") || "");
  if (!sectionId || !["up", "down"].includes(direction)) return;

  await assertCanEditSection(sectionId);

  const section = await db.section.findUnique({
    where: { id: sectionId },
    select: { id: true, courseId: true, order: true },
  });
  if (!section) return;

  // Swap order values with the adjacent section rather than renumbering all.
  const neighbour = await db.section.findFirst({
    where: {
      courseId: section.courseId,
      order: direction === "up" ? { lt: section.order } : { gt: section.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return;

  await db.$transaction([
    db.section.update({
      where: { id: section.id },
      data: { order: neighbour.order },
    }),
    db.section.update({
      where: { id: neighbour.id },
      data: { order: section.order },
    }),
  ]);

  revalidatePath(`/instructor/courses/${section.courseId}`);
}

/* -------------------------------------------------------------------------- */
/* Lessons                                                                     */
/* -------------------------------------------------------------------------- */

export async function createLessonAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = lessonSchema.safeParse({
    sectionId: formData.get("sectionId"),
    title: formData.get("title"),
    type: formData.get("type") ?? "VIDEO",
    summary: formData.get("summary") ?? "",
    contentUrl: formData.get("contentUrl") ?? "",
    contentText: formData.get("contentText") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? 0,
    isPreview: formData.get("isPreview") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const section = await db.section.findUnique({
    where: { id: parsed.data.sectionId },
    select: { courseId: true },
  });
  if (!section) return { errors: { _form: "Section not found." } };

  await assertCanEditCourse(section.courseId);

  const last = await db.lesson.findFirst({
    where: { sectionId: parsed.data.sectionId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.lesson.create({
    data: {
      sectionId: parsed.data.sectionId,
      title: parsed.data.title,
      type: parsed.data.type,
      summary: parsed.data.summary || null,
      contentUrl: parsed.data.contentUrl || null,
      contentText: parsed.data.contentText || null,
      durationSeconds: parsed.data.durationSeconds,
      isPreview: parsed.data.isPreview,
      order: (last?.order ?? -1) + 1,
    },
  });

  await recalcCourseStats(section.courseId);
  revalidatePath(`/instructor/courses/${section.courseId}`);
  return { ok: true, message: "Lesson added." };
}

export async function updateLessonAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const lessonId = String(formData.get("lessonId") || "");
  if (!lessonId) return { errors: { _form: "Missing lesson." } };

  const parsed = lessonSchema.safeParse({
    sectionId: formData.get("sectionId"),
    title: formData.get("title"),
    type: formData.get("type") ?? "VIDEO",
    summary: formData.get("summary") ?? "",
    contentUrl: formData.get("contentUrl") ?? "",
    contentText: formData.get("contentText") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? 0,
    isPreview: formData.get("isPreview") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await assertCanEditLesson(lessonId);

  const lesson = await db.lesson.update({
    where: { id: lessonId },
    data: {
      title: parsed.data.title,
      type: parsed.data.type,
      summary: parsed.data.summary || null,
      contentUrl: parsed.data.contentUrl || null,
      contentText: parsed.data.contentText || null,
      durationSeconds: parsed.data.durationSeconds,
      isPreview: parsed.data.isPreview,
    },
    select: { section: { select: { courseId: true } } },
  });

  await recalcCourseStats(lesson.section.courseId);
  revalidatePath(`/instructor/courses/${lesson.section.courseId}`);
  return { ok: true, message: "Lesson saved." };
}

export async function deleteLessonAction(formData: FormData): Promise<void> {
  const lessonId = String(formData.get("lessonId") || "");
  if (!lessonId) return;

  await assertCanEditLesson(lessonId);

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { contentUrl: true, section: { select: { courseId: true } } },
  });
  if (!lesson) return;

  // Remove the backing file too, so deleting lessons reclaims disk.
  const key = keyFromUrl(lesson.contentUrl);
  if (key) await storage.delete(key);

  await db.lesson.delete({ where: { id: lessonId } });
  await recalcCourseStats(lesson.section.courseId);

  revalidatePath(`/instructor/courses/${lesson.section.courseId}`);
}

export async function moveLessonAction(formData: FormData): Promise<void> {
  const lessonId = String(formData.get("lessonId") || "");
  const direction = String(formData.get("direction") || "");
  if (!lessonId || !["up", "down"].includes(direction)) return;

  await assertCanEditLesson(lessonId);

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      order: true,
      sectionId: true,
      section: { select: { courseId: true } },
    },
  });
  if (!lesson) return;

  const neighbour = await db.lesson.findFirst({
    where: {
      sectionId: lesson.sectionId,
      order: direction === "up" ? { lt: lesson.order } : { gt: lesson.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return;

  await db.$transaction([
    db.lesson.update({ where: { id: lesson.id }, data: { order: neighbour.order } }),
    db.lesson.update({ where: { id: neighbour.id }, data: { order: lesson.order } }),
  ]);

  revalidatePath(`/instructor/courses/${lesson.section.courseId}`);
}

/* -------------------------------------------------------------------------- */
/* Quiz questions                                                              */
/* -------------------------------------------------------------------------- */

export async function saveQuizQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const lessonId = String(formData.get("lessonId") || "");
  const questionId = String(formData.get("questionId") || "");

  // Options arrive as parallel arrays: option[] text plus correct[] indices.
  const texts = formData.getAll("optionText").map(String);
  const correctIndices = new Set(
    formData.getAll("optionCorrect").map((v) => Number(String(v)))
  );

  const parsed = quizQuestionSchema.safeParse({
    lessonId,
    prompt: formData.get("prompt"),
    type: formData.get("type") ?? "SINGLE",
    explanation: formData.get("explanation") ?? "",
    points: formData.get("points") ?? 1,
    options: texts
      .map((text, index) => ({
        text: text.trim(),
        isCorrect: correctIndices.has(index),
      }))
      .filter((option) => option.text.length > 0),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await assertCanEditLesson(parsed.data.lessonId);

  if (questionId) {
    // Replace the option set wholesale — simpler and safer than diffing, and
    // stale attempt records reference option ids that no longer exist only in
    // the answers JSON, which is display-only after grading.
    await db.$transaction([
      db.quizOption.deleteMany({ where: { questionId } }),
      db.quizQuestion.update({
        where: { id: questionId },
        data: {
          prompt: parsed.data.prompt,
          type: parsed.data.type,
          explanation: parsed.data.explanation || null,
          points: parsed.data.points,
          options: {
            create: parsed.data.options.map((option, index) => ({
              text: option.text,
              isCorrect: option.isCorrect,
              order: index,
            })),
          },
        },
      }),
    ]);
  } else {
    const last = await db.quizQuestion.findFirst({
      where: { lessonId: parsed.data.lessonId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    await db.quizQuestion.create({
      data: {
        lessonId: parsed.data.lessonId,
        prompt: parsed.data.prompt,
        type: parsed.data.type,
        explanation: parsed.data.explanation || null,
        points: parsed.data.points,
        order: (last?.order ?? -1) + 1,
        options: {
          create: parsed.data.options.map((option, index) => ({
            text: option.text,
            isCorrect: option.isCorrect,
            order: index,
          })),
        },
      },
    });
  }

  const lesson = await db.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: { section: { select: { courseId: true } } },
  });
  if (lesson) revalidatePath(`/instructor/courses/${lesson.section.courseId}`);

  return { ok: true, message: questionId ? "Question updated." : "Question added." };
}

export async function deleteQuizQuestionAction(
  formData: FormData
): Promise<void> {
  const questionId = String(formData.get("questionId") || "");
  if (!questionId) return;

  const question = await db.quizQuestion.findUnique({
    where: { id: questionId },
    select: { lessonId: true },
  });
  if (!question) return;

  await assertCanEditLesson(question.lessonId);
  await db.quizQuestion.delete({ where: { id: questionId } });

  const lesson = await db.lesson.findUnique({
    where: { id: question.lessonId },
    select: { section: { select: { courseId: true } } },
  });
  if (lesson) revalidatePath(`/instructor/courses/${lesson.section.courseId}`);
}

/* -------------------------------------------------------------------------- */
/* Uploads                                                                     */
/* -------------------------------------------------------------------------- */

export interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Handles thumbnail, lesson video, and resource uploads. Returns a URL the
 * caller writes into the relevant field — the storage driver decides what that
 * URL looks like.
 */
export async function uploadMediaAction(
  formData: FormData
): Promise<UploadResult> {
  await assertRole("INSTRUCTOR");

  const file = formData.get("file");
  const kind = String(formData.get("kind") || "image");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }

  const limit = maxUploadBytes();
  if (file.size > limit) {
    return {
      ok: false,
      error: `File is too large. Maximum is ${Math.round(limit / 1024 / 1024)} MB.`,
    };
  }

  const allowed =
    kind === "video"
      ? ALLOWED_VIDEO_TYPES
      : kind === "resource"
        ? ALLOWED_RESOURCE_TYPES
        : ALLOWED_IMAGE_TYPES;

  if (!allowed.includes(file.type)) {
    return {
      ok: false,
      error: `Unsupported file type. Allowed: ${allowed.join(", ")}`,
    };
  }

  const folder =
    kind === "video" ? "video" : kind === "resource" ? "resource" : "image";

  try {
    const stored = await storage.put(file, {
      folder,
      originalName: file.name,
    });
    return { ok: true, url: stored.url };
  } catch (error) {
    console.error("[upload] failed", error);
    return { ok: false, error: "Upload failed. Try again." };
  }
}

/** Sets the course thumbnail from an already-uploaded URL. */
export async function setCourseThumbnailAction(
  formData: FormData
): Promise<void> {
  const courseId = String(formData.get("courseId") || "");
  const url = String(formData.get("thumbnailUrl") || "");
  if (!courseId) return;

  await assertCanEditCourse(courseId);

  const existing = await db.course.findUnique({
    where: { id: courseId },
    select: { thumbnailUrl: true, slug: true },
  });

  // Clean up the previous file so replaced thumbnails don't accumulate.
  const oldKey = keyFromUrl(existing?.thumbnailUrl);
  if (oldKey && existing?.thumbnailUrl !== url) {
    await storage.delete(oldKey);
  }

  await db.course.update({
    where: { id: courseId },
    data: { thumbnailUrl: url || null },
  });

  revalidatePath(`/instructor/courses/${courseId}`);
  if (existing) revalidatePath(`/courses/${existing.slug}`);
}
