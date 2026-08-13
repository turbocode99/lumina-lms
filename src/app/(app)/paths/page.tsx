import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Route } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Progress } from "@/components/ui/Progress";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { pluralize } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Learning paths" };
export const dynamic = "force-dynamic";

export default async function PathsPage() {
  if (!luminaConfig.features.learningPaths) notFound();
  const user = await requireUser("/paths");

  const [paths, enrollments] = await Promise.all([
    db.learningPath.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true, enrollments: true } },
        createdBy: { select: { name: true } },
      },
    }),
    db.pathEnrollment.findMany({
      where: { userId: user.id },
      select: { pathId: true, progressPercent: true },
    }),
  ]);

  const progressByPath = new Map(
    enrollments.map((e) => [e.pathId, e.progressPercent])
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Learning paths
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Curated sequences of courses that build on each other — onboarding
          tracks, role curricula, and skill ladders.
        </p>
      </header>

      {paths.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Route className="h-9 w-9" />}
            title="No learning paths yet"
            description="Once an administrator publishes a path, it'll appear here."
            action={{ label: "Browse courses instead", href: "/catalog" }}
          />
        </Card>
      ) : (
        <div className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {paths.map((path) => {
            const progress = progressByPath.get(path.id);
            const enrolled = typeof progress === "number";

            return (
              <Link
                key={path.id}
                href={`/paths/${path.slug}`}
                className="neu-interactive group flex flex-col rounded-[var(--radius-neu)] p-6"
              >
                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${path.color}, color-mix(in srgb, ${path.color} 50%, var(--secondary)))`,
                  }}
                >
                  <Route className="h-7 w-7 text-white" />
                </div>

                <h2 className="text-lg font-semibold leading-snug tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                  {path.title}
                </h2>

                {path.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--text-muted)]">
                    {path.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    {pluralize(path._count.items, "course")}
                  </span>
                  <span>{pluralize(path._count.enrollments, "learner")}</span>
                </div>

                <div className="mt-auto pt-5">
                  {enrolled ? (
                    <Progress
                      value={progress}
                      size="sm"
                      showLabel
                      color={path.color}
                      label={progress >= 100 ? "Completed" : "Your progress"}
                    />
                  ) : (
                    <span
                      className="text-sm font-semibold"
                      style={{ color: path.color }}
                    >
                      View path →
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
