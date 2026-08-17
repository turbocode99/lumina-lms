import { ROLE_RANK, ROLES, type Role } from "@/lib/enums";

/**
 * The permission model.
 *
 * This is the single source of truth: the guards in `rbac.ts` check against it,
 * and the admin console at /admin/roles renders it directly. A hand-maintained
 * table of "what each role can do" would drift from the code the first time
 * anyone changed a guard, and a security matrix that lies is worse than none.
 *
 * The model is role-based rather than per-user: a permission names the minimum
 * role that holds it, and roles are ranked LEARNER < INSTRUCTOR < ADMIN. That is
 * deliberately simple for an internal training tool. Two things sit outside the
 * ranking and are noted per-permission:
 *
 *  - Ownership. An instructor may edit *their own* courses, not every course.
 *    Marked `scope: "own"`, enforced by `assertCanEditCourse`.
 *  - Enrollment. Lesson content requires an enrollment rather than a role.
 *    Marked `scope: "enrolled"`, enforced by `canAccessCourseContent`.
 */

export type PermissionScope = "all" | "own" | "enrolled";

export interface PermissionSpec {
  /** Minimum role that holds this permission. */
  minRole: Role;
  /** Grouping for the admin matrix. */
  group: "Learning" | "Authoring" | "Administration" | "Account";
  /** Plain description of what it allows. */
  label: string;
  /**
   * Whether the role grants this over everything, only records the user owns, or
   * only courses they are enrolled in.
   */
  scope: PermissionScope;
  /** Where the check lives, so the matrix can point at the enforcing code. */
  enforcedBy: string;
}

export const PERMISSIONS = {
  /* --- Learning ---------------------------------------------------------- */
  "catalog.browse": {
    minRole: "LEARNER",
    group: "Learning",
    label: "Browse the course catalog",
    scope: "all",
    enforcedBy: "requireUser",
  },
  "course.enroll": {
    minRole: "LEARNER",
    group: "Learning",
    label: "Enroll themselves in a published course",
    scope: "all",
    enforcedBy: "enrollAction",
  },
  "lesson.view": {
    minRole: "LEARNER",
    group: "Learning",
    label: "View lesson content and video",
    scope: "enrolled",
    enforcedBy: "canAccessCourseContent",
  },
  "quiz.attempt": {
    minRole: "LEARNER",
    group: "Learning",
    label: "Take quizzes and see their score",
    scope: "enrolled",
    enforcedBy: "submitQuizAction",
  },
  "note.manage": {
    minRole: "LEARNER",
    group: "Learning",
    label: "Write and delete their own lesson notes",
    scope: "own",
    enforcedBy: "saveNoteAction",
  },
  "review.write": {
    minRole: "LEARNER",
    group: "Learning",
    label: "Review a course they are enrolled in",
    scope: "enrolled",
    enforcedBy: "saveReviewAction",
  },
  "discussion.post": {
    minRole: "LEARNER",
    group: "Learning",
    label: "Ask and answer questions on a course",
    scope: "enrolled",
    enforcedBy: "askQuestionAction",
  },
  "certificate.viewOwn": {
    minRole: "LEARNER",
    group: "Learning",
    label: "View and print their own certificates",
    scope: "own",
    enforcedBy: "certificates/[id]",
  },

  /* --- Authoring --------------------------------------------------------- */
  "course.create": {
    minRole: "INSTRUCTOR",
    group: "Authoring",
    label: "Create a new course",
    scope: "all",
    enforcedBy: "assertRole(INSTRUCTOR)",
  },
  "course.edit": {
    minRole: "INSTRUCTOR",
    group: "Authoring",
    label: "Edit a course, its sections and lessons",
    scope: "own",
    enforcedBy: "assertCanEditCourse",
  },
  "course.publish": {
    minRole: "INSTRUCTOR",
    group: "Authoring",
    label: "Publish, unpublish, or archive a course",
    scope: "own",
    enforcedBy: "setCourseStatusAction",
  },
  "course.delete": {
    minRole: "INSTRUCTOR",
    group: "Authoring",
    label: "Delete a course and all its data",
    scope: "own",
    enforcedBy: "deleteCourseAction",
  },
  "quiz.author": {
    minRole: "INSTRUCTOR",
    group: "Authoring",
    label: "Write quiz questions and mark correct answers",
    scope: "own",
    enforcedBy: "assertCanEditLesson",
  },
  "media.upload": {
    minRole: "INSTRUCTOR",
    group: "Authoring",
    label: "Upload video, thumbnails, and resources",
    scope: "all",
    enforcedBy: "uploadMediaAction",
  },

  /* --- Administration ---------------------------------------------------- */
  "course.moderateAny": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Edit, publish, or delete any course regardless of author",
    scope: "all",
    enforcedBy: "assertCanEditCourse",
  },
  "course.markMandatory": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Flag a course as required training",
    scope: "all",
    enforcedBy: "createCourseAction",
  },
  "user.view": {
    minRole: "ADMIN",
    group: "Administration",
    label: "See everyone on the platform",
    scope: "all",
    enforcedBy: "requireAdmin",
  },
  "user.create": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Create accounts directly",
    scope: "all",
    enforcedBy: "inviteUserAction",
  },
  "user.setRole": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Change anyone's role",
    scope: "all",
    enforcedBy: "updateUserAction",
  },
  "user.deactivate": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Deactivate or reactivate an account",
    scope: "all",
    enforcedBy: "updateUserAction",
  },
  "user.resetPassword": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Set a new password for another account",
    scope: "all",
    enforcedBy: "resetUserPasswordAction",
  },
  "category.manage": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Create, edit, and delete catalog categories",
    scope: "all",
    enforcedBy: "createCategoryAction",
  },
  "path.manage": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Build and publish learning paths",
    scope: "all",
    enforcedBy: "saveLearningPathAction",
  },
  "training.assign": {
    minRole: "ADMIN",
    group: "Administration",
    label: "Assign required training with due dates",
    scope: "all",
    enforcedBy: "assignTrainingAction",
  },
  "certificate.viewAny": {
    minRole: "ADMIN",
    group: "Administration",
    label: "View the org-wide certificate register",
    scope: "all",
    enforcedBy: "requireAdmin",
  },
  "analytics.view": {
    minRole: "ADMIN",
    group: "Administration",
    label: "See organisation-wide analytics and the activity log",
    scope: "all",
    enforcedBy: "requireAdmin",
  },

  /* --- Account ----------------------------------------------------------- */
  "account.editOwnProfile": {
    minRole: "LEARNER",
    group: "Account",
    label: "Edit their own name, title, and bio",
    scope: "own",
    enforcedBy: "updateProfileAction",
  },
  "account.changeOwnPassword": {
    minRole: "LEARNER",
    group: "Account",
    label: "Change their own password",
    scope: "own",
    enforcedBy: "changePasswordAction",
  },
} as const satisfies Record<string, PermissionSpec>;

export type Permission = keyof typeof PERMISSIONS;

/** Does this role hold the permission at all? Scope is checked separately. */
export function roleHas(role: Role, permission: Permission): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[PERMISSIONS[permission].minRole];
}

/** Every permission a role holds, for the admin matrix and for tests. */
export function permissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => roleHas(role, p));
}

/** Groups in a stable display order. */
export const PERMISSION_GROUPS = [
  "Learning",
  "Authoring",
  "Administration",
  "Account",
] as const;

export function permissionsByGroup() {
  return PERMISSION_GROUPS.map((group) => ({
    group,
    permissions: (Object.entries(PERMISSIONS) as [Permission, PermissionSpec][])
      .filter(([, spec]) => spec.group === group)
      .map(([key, spec]) => ({ key, ...spec })),
  })).filter((entry) => entry.permissions.length > 0);
}

/** Short description of each role, shown alongside the matrix. */
export const ROLE_SUMMARY: Record<Role, { label: string; summary: string }> = {
  LEARNER: {
    label: "Learner",
    summary:
      "Takes courses. Can browse the catalog, enrol, and work through lessons, quizzes, and discussions. Sees only their own progress and certificates.",
  },
  INSTRUCTOR: {
    label: "Instructor",
    summary:
      "Everything a learner can do, plus authoring. Creates and publishes courses and quizzes, and uploads media — but only for courses they own.",
  },
  ADMIN: {
    label: "Administrator",
    summary:
      "Everything an instructor can do, over every course. Also manages people and roles, categories, learning paths, required training, and sees org-wide analytics.",
  },
};

export { ROLES, ROLE_RANK };
export type { Role };
