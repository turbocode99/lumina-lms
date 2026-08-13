import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";

import { CourseCard, type CourseCardData } from "@/components/CourseCard";
import { EmptyState, CardSkeleton } from "@/components/ui/EmptyState";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

import { CatalogFilters } from "./CatalogFilters";

export const metadata: Metadata = { title: "Catalog" };
export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  category?: string;
  level?: string;
  sort?: string;
  mandatory?: string;
  page?: string;
};

function orderFor(sort: string | undefined) {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }];
    case "rating":
      return [{ ratingAvg: "desc" as const }, { ratingCount: "desc" as const }];
    case "title":
      return [{ title: "asc" as const }];
    case "duration":
      return [{ durationMinutes: "asc" as const }];
    default:
      return [{ enrollmentCount: "desc" as const }, { ratingAvg: "desc" as const }];
  }
}

async function CatalogResults({ params }: { params: SearchParams }) {
  const user = await requireUser("/catalog");
  const pageSize = luminaConfig.catalog.pageSize;
  const page = Math.max(1, Number(params.page) || 1);

  const q = params.q?.trim();

  /**
   * SQLite has no case-insensitive `mode` for `contains`, so this relies on the
   * default NOCASE-ish behaviour for ASCII. On PostgreSQL, add
   * `mode: "insensitive"` to each clause for full Unicode case folding.
   */
  const where = {
    status: "PUBLISHED" as const,
    ...(params.category ? { categoryId: params.category } : {}),
    ...(params.level ? { level: params.level } : {}),
    ...(params.mandatory === "1" ? { isMandatory: true } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { subtitle: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } },
            { instructor: { name: { contains: q } } },
            { category: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [courses, total, categories, enrollments] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: orderFor(params.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        thumbnailUrl: true,
        level: true,
        durationMinutes: true,
        lessonCount: true,
        ratingAvg: true,
        ratingCount: true,
        enrollmentCount: true,
        isMandatory: true,
        instructor: { select: { name: true } },
        category: { select: { name: true, color: true } },
      },
    }),
    db.course.count({ where }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    db.enrollment.findMany({
      where: { userId: user.id },
      select: { courseId: true, progressPercent: true },
    }),
  ]);

  const progressByCourse = new Map(
    enrollments.map((e) => [e.courseId, e.progressPercent])
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const linkFor = (targetPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.category) search.set("category", params.category);
    if (params.level) search.set("level", params.level);
    if (params.sort) search.set("sort", params.sort);
    if (params.mandatory) search.set("mandatory", params.mandatory);
    if (targetPage > 1) search.set("page", String(targetPage));
    const qs = search.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  };

  return (
    <>
      <CatalogFilters categories={categories} total={total} />

      {courses.length === 0 ? (
        <div className="neu mt-6 rounded-[var(--radius-neu)]">
          <EmptyState
            icon={<SearchX className="h-9 w-9" />}
            title="No courses match your filters"
            description={
              q
                ? `Nothing found for "${q}". Try a different search or clear your filters.`
                : "Try widening your filters, or check back once more courses are published."
            }
            action={{ label: "Clear all filters", href: "/catalog" }}
          />
        </div>
      ) : (
        <>
          <div className="stagger mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course as CourseCardData}
                progress={progressByCourse.get(course.id) ?? null}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-center gap-2"
              aria-label="Pagination"
            >
              <Link
                href={linkFor(page - 1)}
                aria-disabled={page === 1}
                className={cn(
                  "neu-interactive flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)]",
                  page === 1 && "pointer-events-none opacity-40"
                )}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                // Show first, last, and a window around the current page.
                .filter(
                  (n) =>
                    n === 1 ||
                    n === totalPages ||
                    Math.abs(n - page) <= 1
                )
                .map((n, index, list) => (
                  <span key={n} className="flex items-center gap-2">
                    {index > 0 && list[index - 1] !== n - 1 && (
                      <span className="px-1 text-[var(--text-muted)]">…</span>
                    )}
                    <Link
                      href={linkFor(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={cn(
                        "flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-medium transition-all",
                        n === page
                          ? "neu-pressed text-[var(--accent)]"
                          : "neu-interactive text-[var(--text-secondary)]"
                      )}
                    >
                      {n}
                    </Link>
                  </span>
                ))}

              <Link
                href={linkFor(page + 1)}
                aria-disabled={page === totalPages}
                className={cn(
                  "neu-interactive flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)]",
                  page === totalPages && "pointer-events-none opacity-40"
                )}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </nav>
          )}
        </>
      )}
    </>
  );
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Course catalog
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Everything {luminaConfig.brand.organization} offers, in one place.
        </p>
      </header>

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <CatalogResults params={params} />
      </Suspense>
    </div>
  );
}
