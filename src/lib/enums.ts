/**
 * The schema stores these as plain strings so it stays portable across SQLite,
 * PostgreSQL, and MySQL. These constants are the single source of truth for the
 * allowed values and are what the zod validators check against.
 */

export const ROLES = ["LEARNER", "INSTRUCTOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const COURSE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const LESSON_TYPES = ["VIDEO", "ARTICLE", "QUIZ", "RESOURCE"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const QUESTION_TYPES = ["SINGLE", "MULTI", "TRUE_FALSE"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ENROLLMENT_SOURCES = ["SELF", "ASSIGNED", "PATH"] as const;
export type EnrollmentSource = (typeof ENROLLMENT_SOURCES)[number];

export const COURSE_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "All Levels",
] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const NOTIFICATION_TYPES = [
  "ASSIGNMENT",
  "DUE_SOON",
  "OVERDUE",
  "ANSWER",
  "REVIEW",
  "CERTIFICATE",
  "ENROLLMENT",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Role ranking used by `atLeast()` in rbac.ts. Higher wins. */
export const ROLE_RANK: Record<Role, number> = {
  LEARNER: 0,
  INSTRUCTOR: 1,
  ADMIN: 2,
};

export const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  VIDEO: "Video",
  ARTICLE: "Article",
  QUIZ: "Quiz",
  RESOURCE: "Resource",
};
