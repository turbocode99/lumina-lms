import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PathManager } from "@/components/admin/PathManager";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Learning paths" };
export const dynamic = "force-dynamic";

export default async function AdminPathsPage() {
  if (!luminaConfig.features.learningPaths) notFound();
  await requireAdmin("/admin/paths");

  const [paths, courses] = await Promise.all([
    db.learningPath.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { order: "asc" },
          select: {
            courseId: true,
            order: true,
            course: { select: { title: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    }),
    // Only published courses can be sequenced — a draft in a path would be a
    // dead end for anyone who enrolls.
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { title: "asc" },
      select: { id: true, title: true, lessonCount: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Learning paths
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Sequence published courses into onboarding tracks and role curricula.
          Enrolling in a path enrolls the learner in every course it contains.
        </p>
      </header>

      <PathManager paths={paths} courses={courses} />
    </div>
  );
}
