import "server-only";

import { notFound, redirect } from "next/navigation";

import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { ROLE_RANK, type Role } from "@/lib/enums";
import { roleHas, type Permission } from "@/lib/permissions";
import { db } from "@/lib/db";

/**
 * Authorization helpers.
 *
 * Every server component and server action goes through one of these rather
 * than reading the session directly, so there is exactly one place where "who
 * may do this" is decided.
 */

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function atLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Role-based permission check. See src/lib/permissions.ts for the model. */
export function can(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return roleHas(user.role, permission);
}

/**
 * Sends the user to the 403 page with enough context to explain the refusal.
 *
 * Previously this redirected to `/dashboard?error=forbidden`, but the dashboard
 * never read that parameter — so a blocked user was bounced silently with no idea
 * what had happened or why.
 */
function denyAccess(reason: string, required?: Role): never {
  const params = new URLSearchParams({ reason });
  if (required) params.set("required", required);
  redirect(`/forbidden?${params.toString()}`);
}

/** For pages: redirects to login instead of throwing. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${target}`);
  }
  return user;
}

export async function requireRole(
  minimum: Role,
  returnTo?: string
): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!atLeast(user.role, minimum)) {
    denyAccess("role", minimum);
  }
  return user;
}

export async function requireInstructor(returnTo?: string) {
  return requireRole("INSTRUCTOR", returnTo);
}

export async function requireAdmin(returnTo?: string) {
  return requireRole("ADMIN", returnTo);
}

/**
 * Page-context equivalent of `assertCanEditCourse`.
 *
 * The assert* helpers throw, which is right inside a server action where the
 * caller turns the error into a message. Thrown from a *page* with no error
 * boundary it produced a raw HTTP 500 — access was correctly denied, but the
 * failure looked like a crash. This denies gracefully instead.
 */
export async function requireCourseEditor(courseId: string): Promise<SessionUser> {
  const user = await requireRole("INSTRUCTOR");
  if (user.role === "ADMIN") return user;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (!course) notFound();
  if (course.instructorId !== user.id) {
    denyAccess("ownership");
  }
  return user;
}

/** For server actions: throws so the action can return a typed error. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You must be signed in.");
  return user;
}

export async function assertRole(minimum: Role): Promise<SessionUser> {
  const user = await assertUser();
  if (!atLeast(user.role, minimum)) throw new AuthorizationError();
  return user;
}

/**
 * A course may be edited by its own instructor or by any admin. Returns the
 * user so callers can log who made the change.
 */
export async function assertCanEditCourse(courseId: string): Promise<SessionUser> {
  const user = await assertRole("INSTRUCTOR");
  if (user.role === "ADMIN") return user;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (!course) throw new AuthorizationError("Course not found.");
  if (course.instructorId !== user.id) {
    throw new AuthorizationError("You can only edit courses you own.");
  }
  return user;
}

/** Same rule, resolved from a lesson id. */
export async function assertCanEditLesson(lessonId: string): Promise<SessionUser> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { section: { select: { courseId: true } } },
  });
  if (!lesson) throw new AuthorizationError("Lesson not found.");
  return assertCanEditCourse(lesson.section.courseId);
}

export async function assertCanEditSection(sectionId: string): Promise<SessionUser> {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    select: { courseId: true },
  });
  if (!section) throw new AuthorizationError("Section not found.");
  return assertCanEditCourse(section.courseId);
}

/**
 * Content access rule for the player: enrolled learners, the course owner, and
 * admins get full access; everyone else only sees preview lessons.
 */
export async function canAccessCourseContent(
  user: SessionUser | null,
  courseId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (course?.instructorId === user.id) return true;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  return Boolean(enrollment);
}
