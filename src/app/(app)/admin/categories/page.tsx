import type { Metadata } from "next";

import { CategoryManager } from "@/components/admin/CategoryManager";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");

  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { courses: true } } },
  });

  return (
    <div className="mx-auto max-w-[900px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Categories
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          How the catalog is organised. Deleting a category leaves its courses in
          place — they just become uncategorised.
        </p>
      </header>

      <CategoryManager categories={categories} />
    </div>
  );
}
