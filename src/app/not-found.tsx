import Link from "next/link";
import { Compass, SearchX } from "lucide-react";

export const metadata = { title: "Not found" };

/**
 * Shown for unknown URLs and for `notFound()` calls — including a course, lesson,
 * or certificate that either does not exist or is not visible to this user. The
 * wording is deliberately the same either way, so it cannot be used to work out
 * whether a hidden record exists.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="neu-lg w-full max-w-lg rounded-[var(--radius-neu-lg)] p-8 text-center">
        <span className="neu-inset mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full text-[var(--text-muted)]">
          <SearchX className="h-8 w-8" />
        </span>

        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          We couldn&apos;t find that
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          The page may have moved, or you may not have access to it.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="neu-accent inline-flex items-center rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Back to dashboard
          </Link>
          <Link
            href="/catalog"
            className="neu-interactive inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium text-[var(--text-secondary)]"
          >
            <Compass className="h-4 w-4" />
            Browse catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
