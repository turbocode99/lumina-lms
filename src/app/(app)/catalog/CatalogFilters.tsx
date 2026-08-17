"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { COURSE_LEVELS } from "@/lib/enums";

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

const SORTS = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest rated" },
  { value: "title", label: "A–Z" },
  { value: "duration", label: "Shortest first" },
];

/**
 * Filters are URL state, not component state — that keeps the results server
 * rendered, makes every filtered view linkable, and survives a refresh.
 */
export function CatalogFilters({
  categories,
  total,
}: {
  categories: CategoryOption[];
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(false);

  const current = {
    category: params.get("category") ?? "",
    level: params.get("level") ?? "",
    sort: params.get("sort") ?? "popular",
    mandatory: params.get("mandatory") === "1",
  };

  const push = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") search.delete(key);
      else search.set(key, value);
    }
    // Any filter change resets pagination.
    search.delete("page");
    startTransition(() => {
      router.push(`/catalog?${search.toString()}`);
    });
  };

  const activeCount =
    (current.category ? 1 : 0) +
    (current.level ? 1 : 0) +
    (current.mandatory ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: query.trim() || null });
          }}
          className="min-w-[240px] flex-1"
          data-tour="catalog-search"
        >
          <div className="neu-inset neu-input flex items-center gap-2.5 rounded-2xl px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, topic, or instructor…"
              aria-label="Search courses"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  push({ q: null });
                }}
                aria-label="Clear search"
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>

        <Button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          data-tour="catalog-filters"
          className={cn(showFilters && "neu-pressed")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </Button>

        <div className="neu-inset neu-input flex items-center rounded-2xl px-4 py-3">
          <label htmlFor="sort" className="sr-only">
            Sort courses
          </label>
          <select
            id="sort"
            value={current.sort}
            onChange={(e) => push({ sort: e.target.value })}
            className="cursor-pointer bg-transparent text-sm outline-none [&>option]:bg-[var(--surface)]"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="neu animate-fade-up rounded-[var(--radius-neu)] p-5">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Category
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => push({ category: null })}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                    !current.category
                      ? "neu-pressed text-[var(--accent)]"
                      : "neu-sm text-[var(--text-secondary)]"
                  )}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => push({ category: category.id })}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                      current.category === category.id
                        ? "neu-pressed"
                        : "neu-sm text-[var(--text-secondary)]"
                    )}
                    style={
                      current.category === category.id
                        ? { color: category.color }
                        : undefined
                    }
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Level
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => push({ level: null })}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                    !current.level
                      ? "neu-pressed text-[var(--accent)]"
                      : "neu-sm text-[var(--text-secondary)]"
                  )}
                >
                  All
                </button>
                {COURSE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => push({ level })}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                      current.level === level
                        ? "neu-pressed text-[var(--accent)]"
                        : "neu-sm text-[var(--text-secondary)]"
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Type
              </p>
              <button
                type="button"
                onClick={() => push({ mandatory: current.mandatory ? null : "1" })}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                  current.mandatory
                    ? "neu-pressed text-[var(--danger)]"
                    : "neu-sm text-[var(--text-secondary)]"
                )}
              >
                Required training only
              </button>
            </div>
          </div>

          {activeCount > 0 && (
            <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
              <Button
                size="sm"
                onClick={() =>
                  push({ category: null, level: null, mandatory: null })
                }
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      <p
        className={cn(
          "text-sm text-[var(--text-muted)] transition-opacity",
          pending && "opacity-50"
        )}
      >
        {total.toLocaleString()} {total === 1 ? "course" : "courses"}
      </p>
    </div>
  );
}

export default CatalogFilters;
