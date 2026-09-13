"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { assertRole } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { logActivity, notify, notifyMany } from "@/lib/notify";
import { recalcPathProgress } from "@/lib/progress";
import { runDueReminders } from "@/lib/reminders";
import { slugify, uniqueSlug } from "@/lib/utils";
import {
  assignmentSchema,
  categorySchema,
  fieldErrors,
  inviteUserSchema,
  learningPathSchema,
  userAdminSchema,
} from "@/lib/validators";

import type { ActionState } from "./auth";

export type { ActionState };

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export async function inviteUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await assertRole("ADMIN");

  const parsed = inviteUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") ?? "LEARNER",
    department: formData.get("department") ?? "",
    title: formData.get("title") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return { errors: { email: "An account with this email already exists." } };
  }

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      department: parsed.data.department || null,
      title: parsed.data.title || null,
    },
    select: { id: true },
  });

  await notify({
    userId: user.id,
    type: "SYSTEM",
    title: "Welcome aboard",
    body: "Your learning account is ready. Change your password from your profile.",
    link: "/profile#security",
  });

  await logActivity({
    userId: admin.id,
    action: "user.create",
    entity: "user",
    entityId: user.id,
    meta: { role: parsed.data.role },
  });

  revalidatePath("/admin/users");
  return {
    ok: true,
    message: `${parsed.data.name} added. Share the temporary password with them.`,
  };
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await assertRole("ADMIN");

  const parsed = userAdminSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    isActive: formData.get("isActive") === "on",
    department: formData.get("department") ?? "",
    title: formData.get("title") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Guard against an admin locking themselves — and possibly everyone — out.
  if (parsed.data.userId === admin.id) {
    if (parsed.data.role !== "ADMIN") {
      return { errors: { role: "You can't remove your own admin role." } };
    }
    if (!parsed.data.isActive) {
      return { errors: { isActive: "You can't deactivate your own account." } };
    }
  }

  // Never leave the instance with zero active admins.
  if (parsed.data.role !== "ADMIN" || !parsed.data.isActive) {
    const target = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { role: true },
    });
    if (target?.role === "ADMIN") {
      const activeAdmins = await db.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (activeAdmins <= 1) {
        return {
          errors: {
            _form: "This is the last active administrator. Promote someone else first.",
          },
        };
      }
    }
  }

  await db.user.update({
    where: { id: parsed.data.userId },
    data: {
      role: parsed.data.role,
      isActive: parsed.data.isActive,
      department: parsed.data.department || null,
      title: parsed.data.title || null,
    },
  });

  await logActivity({
    userId: admin.id,
    action: "user.update",
    entity: "user",
    entityId: parsed.data.userId,
    meta: { role: parsed.data.role, isActive: parsed.data.isActive },
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "User updated." };
}

export async function resetUserPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await assertRole("ADMIN");

  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  if (!userId) return { errors: { _form: "Missing user." } };
  if (password.length < 8) {
    return { errors: { password: "Password must be at least 8 characters." } };
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  await notify({
    userId,
    type: "SYSTEM",
    title: "Your password was reset",
    body: "An administrator set a new password on your account.",
    link: "/profile#security",
  });

  await logActivity({
    userId: admin.id,
    action: "user.password_reset",
    entity: "user",
    entityId: userId,
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Password reset. Share it with them securely." };
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertRole("ADMIN");

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || "BookOpen",
    color: formData.get("color") || "#6366f1",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const existing = await db.category.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (existing) return { errors: { name: "That category already exists." } };

  const last = await db.category.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.category.create({
    data: {
      name: parsed.data.name,
      slug: await uniqueSlug(parsed.data.name, async (candidate) =>
        Boolean(
          await db.category.findUnique({
            where: { slug: candidate },
            select: { id: true },
          })
        )
      ),
      icon: parsed.data.icon,
      color: parsed.data.color,
      description: parsed.data.description || null,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/catalog");
  return { ok: true, message: "Category created." };
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");

  const categoryId = String(formData.get("categoryId") || "");
  const name = String(formData.get("name") || "").trim();
  const color = String(formData.get("color") || "");
  const icon = String(formData.get("icon") || "BookOpen");
  if (!categoryId || name.length < 2) return;

  await db.category.update({
    where: { id: categoryId },
    data: {
      name: name.slice(0, 60),
      color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined,
      icon: icon.slice(0, 40),
      slug: slugify(name),
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/catalog");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");

  const categoryId = String(formData.get("categoryId") || "");
  if (!categoryId) return;

  // Courses in this category are kept — the FK is SetNull, so they simply
  // become uncategorised rather than disappearing from the catalog.
  await db.category.delete({ where: { id: categoryId } });

  revalidatePath("/admin/categories");
  revalidatePath("/catalog");
}

/* -------------------------------------------------------------------------- */
/* Learning paths                                                              */
/* -------------------------------------------------------------------------- */

export async function saveLearningPathAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await assertRole("ADMIN");

  const pathId = String(formData.get("pathId") || "");
  const courseIds = formData.getAll("courseIds").map(String).filter(Boolean);

  const parsed = learningPathSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    color: formData.get("color") || "#6366f1",
    courseIds,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (pathId) {
    await db.learningPath.update({
      where: { id: pathId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        color: parsed.data.color,
      },
    });

    // Rebuild the item list so ordering matches the submitted sequence.
    await db.pathItem.deleteMany({ where: { pathId } });
    await db.pathItem.createMany({
      data: parsed.data.courseIds.map((courseId, index) => ({
        pathId,
        courseId,
        order: index,
        isRequired: true,
      })),
    });

    // Anyone already on this path needs their percentage recomputed against
    // the new course set.
    const enrolled = await db.pathEnrollment.findMany({
      where: { pathId },
      select: { userId: true },
    });
    for (const { userId } of enrolled) {
      await recalcPathProgress(userId, pathId);
    }

    revalidatePath("/admin/paths");
    revalidatePath("/paths");
    return { ok: true, message: "Path updated." };
  }

  const slug = await uniqueSlug(parsed.data.title, async (candidate) =>
    Boolean(
      await db.learningPath.findUnique({
        where: { slug: candidate },
        select: { id: true },
      })
    )
  );

  const created = await db.learningPath.create({
    data: {
      slug,
      title: parsed.data.title,
      description: parsed.data.description || null,
      color: parsed.data.color,
      createdById: admin.id,
      items: {
        create: parsed.data.courseIds.map((courseId, index) => ({
          courseId,
          order: index,
          isRequired: true,
        })),
      },
    },
    select: { id: true },
  });

  await logActivity({
    userId: admin.id,
    action: "path.create",
    entity: "path",
    entityId: created.id,
  });

  revalidatePath("/admin/paths");
  revalidatePath("/paths");
  return { ok: true, message: "Path created." };
}

export async function setPathPublishedAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");

  const pathId = String(formData.get("pathId") || "");
  const publish = formData.get("publish") === "true";
  if (!pathId) return;

  await db.learningPath.update({
    where: { id: pathId },
    data: { isPublished: publish },
  });

  revalidatePath("/admin/paths");
  revalidatePath("/paths");
}

export async function deletePathAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");

  const pathId = String(formData.get("pathId") || "");
  if (!pathId) return;

  await db.learningPath.delete({ where: { id: pathId } });

  revalidatePath("/admin/paths");
  revalidatePath("/paths");
}

/* -------------------------------------------------------------------------- */
/* Mandatory training assignments                                              */
/* -------------------------------------------------------------------------- */

export async function assignTrainingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await assertRole("ADMIN");

  const parsed = assignmentSchema.safeParse({
    userIds: formData.getAll("userIds").map(String).filter(Boolean),
    courseId: formData.get("courseId") ?? "",
    pathId: formData.get("pathId") ?? "",
    dueAt: formData.get("dueAt") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return { errors: { dueAt: "That date isn't valid." } };
  }

  const target = parsed.data.courseId
    ? await db.course.findUnique({
        where: { id: parsed.data.courseId },
        select: { id: true, title: true, slug: true },
      })
    : await db.learningPath.findUnique({
        where: { id: parsed.data.pathId! },
        select: { id: true, title: true, slug: true },
      });

  if (!target) return { errors: { _form: "That course or path no longer exists." } };

  const isCourse = Boolean(parsed.data.courseId);
  let created = 0;

  for (const userId of parsed.data.userIds) {
    // Don't stack duplicate open assignments for the same target.
    const existing = await db.assignment.findFirst({
      where: {
        userId,
        courseId: isCourse ? target.id : null,
        pathId: isCourse ? null : target.id,
        completedAt: null,
      },
      select: { id: true },
    });
    if (existing) continue;

    await db.assignment.create({
      data: {
        userId,
        assignedById: admin.id,
        courseId: isCourse ? target.id : null,
        pathId: isCourse ? null : target.id,
        dueAt,
        note: parsed.data.note || null,
      },
    });
    created += 1;

    // Assigning also enrolls, so the training shows up in My Learning at once.
    if (isCourse) {
      const enrolled = await db.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: target.id } },
        select: { id: true },
      });
      if (!enrolled) {
        await db.$transaction([
          db.enrollment.create({
            data: { userId, courseId: target.id, source: "ASSIGNED" },
          }),
          db.course.update({
            where: { id: target.id },
            data: { enrollmentCount: { increment: 1 } },
          }),
        ]);
      }
    } else {
      await db.pathEnrollment.upsert({
        where: { userId_pathId: { userId, pathId: target.id } },
        create: { userId, pathId: target.id },
        update: {},
      });

      const items = await db.pathItem.findMany({
        where: { pathId: target.id },
        select: { courseId: true },
      });
      for (const item of items) {
        const enrolled = await db.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: item.courseId } },
          select: { id: true },
        });
        if (enrolled) continue;
        await db.$transaction([
          db.enrollment.create({
            data: { userId, courseId: item.courseId, source: "PATH" },
          }),
          db.course.update({
            where: { id: item.courseId },
            data: { enrollmentCount: { increment: 1 } },
          }),
        ]);
      }
      await recalcPathProgress(userId, target.id);
    }
  }

  await notifyMany(
    parsed.data.userIds.map((userId) => ({
      userId,
      type: "ASSIGNMENT" as const,
      title: `New required training: ${target.title}`,
      body: dueAt
        ? `Due ${dueAt.toLocaleDateString()}. ${parsed.data.note ?? ""}`.trim()
        : parsed.data.note || "Assigned to you by your learning administrator.",
      link: isCourse ? `/courses/${target.slug}` : `/paths/${target.slug}`,
    }))
  );

  await logActivity({
    userId: admin.id,
    action: "training.assign",
    entity: isCourse ? "course" : "path",
    entityId: target.id,
    meta: { count: created },
  });

  revalidatePath("/admin/assignments");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message:
      created > 0
        ? `Assigned to ${created} ${created === 1 ? "person" : "people"}.`
        : "Everyone selected already had this assigned.",
  };
}

export async function deleteAssignmentAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");

  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) return;

  await db.assignment.delete({ where: { id: assignmentId } });

  revalidatePath("/admin/assignments");
  revalidatePath("/dashboard");
}

/** Nudges everyone with an open assignment that's overdue or due soon. */
/**
 * The button now runs the same sweep as the schedule, rather than its own copy.
 *
 * Two behaviours change as a result, both deliberate. It honours
 * `dueSoonReminderDays` instead of a hardcoded seven, which is what that setting
 * always claimed to control. And it no longer re-notifies people it reminded in
 * the last `reminderRepeatDays` — pressing it twice used to send everything
 * twice, which mattered little when reminders were only in-app and matters
 * considerably now that they can be email.
 */
export async function sendDueRemindersAction(): Promise<void> {
  const admin = await assertRole("ADMIN");

  const run = await runDueReminders();

  await logActivity({
    userId: admin.id,
    action: "training.remind",
    entity: "assignment",
    meta: { count: run.sent, overdue: run.overdue, skipped: run.skipped },
  });

  revalidatePath("/admin/assignments");
}

/* -------------------------------------------------------------------------- */
/* Course moderation                                                           */
/* -------------------------------------------------------------------------- */

export async function adminSetCourseStatusAction(
  formData: FormData
): Promise<void> {
  const admin = await assertRole("ADMIN");

  const courseId = String(formData.get("courseId") || "");
  const status = String(formData.get("status") || "");
  if (!courseId || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return;

  await db.course.update({
    where: { id: courseId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  await logActivity({
    userId: admin.id,
    action: `course.${status.toLowerCase()}`,
    entity: "course",
    entityId: courseId,
  });

  revalidatePath("/admin/courses");
  revalidatePath("/catalog");
}
