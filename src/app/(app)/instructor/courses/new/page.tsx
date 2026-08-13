import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CourseForm } from "@/components/instructor/CourseForm";
import { Card } from "@/components/ui/Card";
import { db } from "@/lib/db";
import { requireInstructor } from "@/lib/rbac";

export const metadata: Metadata = { title: "New course" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const user = await requireInstructor("/instructor/courses/new");

  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-[820px]">
      <Link
        href="/instructor"
        className="neu-interactive mb-6 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my courses
      </Link>

      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Create a course
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Start with the outline. You&apos;ll add sections, lessons, and quizzes
          next — nothing is visible to learners until you publish.
        </p>
      </header>

      <Card>
        <CourseForm
          categories={categories}
          canSetMandatory={user.role === "ADMIN"}
          mode="create"
        />
      </Card>
    </div>
  );
}
