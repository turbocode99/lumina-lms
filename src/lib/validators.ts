import { z } from "zod";

import {
  COURSE_LEVELS,
  COURSE_STATUSES,
  LESSON_TYPES,
  QUESTION_TYPES,
  ROLES,
} from "@/lib/enums";

/** Every server action parses its FormData through one of these schemas. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Email is required.")
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    department: z.string().trim().max(80).optional().or(z.literal("")),
    title: z.string().trim().max(80).optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  department: z.string().trim().max(80).optional().or(z.literal("")),
  headline: z.string().trim().max(140).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const courseSchema = z.object({
  title: z.string().trim().min(4, "Title must be at least 4 characters.").max(120),
  subtitle: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(8000).optional().or(z.literal("")),
  categoryId: z.string().trim().optional().or(z.literal("")),
  level: z.enum(COURSE_LEVELS).default("All Levels"),
  language: z.string().trim().max(40).default("English"),
  objectives: z.string().max(4000).optional().or(z.literal("")),
  requirements: z.string().max(4000).optional().or(z.literal("")),
  audience: z.string().max(4000).optional().or(z.literal("")),
  tags: z.string().max(600).optional().or(z.literal("")),
  isMandatory: z.boolean().default(false),
});

export const courseStatusSchema = z.object({
  courseId: z.string().min(1),
  status: z.enum(COURSE_STATUSES),
});

export const sectionSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(2, "Section title is required.").max(120),
});

export const lessonSchema = z.object({
  sectionId: z.string().min(1),
  title: z.string().trim().min(2, "Lesson title is required.").max(140),
  type: z.enum(LESSON_TYPES).default("VIDEO"),
  summary: z.string().trim().max(400).optional().or(z.literal("")),
  contentUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  contentText: z.string().max(60000).optional().or(z.literal("")),
  durationSeconds: z.coerce.number().int().min(0).max(86_400).default(0),
  isPreview: z.boolean().default(false),
});

export const quizQuestionSchema = z.object({
  lessonId: z.string().min(1),
  prompt: z.string().trim().min(4, "Write the question.").max(600),
  type: z.enum(QUESTION_TYPES).default("SINGLE"),
  explanation: z.string().trim().max(1000).optional().or(z.literal("")),
  points: z.coerce.number().int().min(1).max(20).default(1),
  /** At least two options, at least one marked correct. */
  options: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Option text is required.").max(300),
        isCorrect: z.boolean().default(false),
      })
    )
    .min(2, "Add at least two options.")
    .max(8, "A question can have at most eight options.")
    .refine((opts) => opts.some((o) => o.isCorrect), {
      message: "Mark at least one option as correct.",
    }),
});

export const reviewSchema = z.object({
  courseId: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Pick a rating.").max(5),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const noteSchema = z.object({
  lessonId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first.").max(4000),
  timestampSeconds: z.coerce.number().int().min(0).default(0),
});

export const questionSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().optional().or(z.literal("")),
  title: z.string().trim().min(4, "Give your question a title.").max(200),
  body: z.string().trim().min(4, "Add some detail.").max(4000),
});

export const answerSchema = z.object({
  questionId: z.string().min(1),
  body: z.string().trim().min(2, "Write your answer.").max(4000),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(60),
  icon: z.string().trim().max(40).default("BookOpen"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6366f1")
    .default("#6366f1"),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export const learningPathSchema = z.object({
  title: z.string().trim().min(4, "Path title is required.").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6366f1")
    .default("#6366f1"),
  courseIds: z.array(z.string()).default([]),
});

export const assignmentSchema = z
  .object({
    userIds: z.array(z.string().min(1)).min(1, "Select at least one person."),
    courseId: z.string().optional().or(z.literal("")),
    pathId: z.string().optional().or(z.literal("")),
    dueAt: z.string().optional().or(z.literal("")),
    note: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.courseId) !== Boolean(data.pathId), {
    message: "Assign either a course or a learning path, not both.",
    path: ["courseId"],
  });

export const userAdminSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
  isActive: z.boolean().default(true),
  department: z.string().trim().max(80).optional().or(z.literal("")),
  title: z.string().trim().max(80).optional().or(z.literal("")),
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a full name.").max(80),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES).default("LEARNER"),
  department: z.string().trim().max(80).optional().or(z.literal("")),
  title: z.string().trim().max(80).optional().or(z.literal("")),
});

/** Collapses a ZodError into the `{ field: message }` shape the forms render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
