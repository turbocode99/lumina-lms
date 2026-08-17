"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * Without one, any thrown error — including an authorization error escaping a
 * server component — rendered Next.js's bare error screen, which looks like the
 * app has fallen over. This shows something intelligible and offers a retry.
 *
 * The message itself is deliberately not shown in production: server errors can
 * carry query fragments or internal paths, and this page is reachable by anyone.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side errors are already logged by Next; this catches client ones.
    console.error("[lumina] unhandled error", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="neu-lg w-full max-w-lg rounded-[var(--radius-neu-lg)] p-8 text-center">
        <span className="neu-inset mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full text-[var(--danger)]">
          <AlertTriangle className="h-8 w-8" />
        </span>

        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This page failed to load. Trying again often clears it.
        </p>

        {isDev && (
          <pre className="neu-inset mt-5 max-h-48 overflow-auto rounded-2xl p-4 text-left text-xs text-[var(--danger)]">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}

        {error.digest && !isDev && (
          <p className="mt-4 font-mono text-xs text-[var(--text-muted)]">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="neu-accent inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <a
            href="/dashboard"
            className="neu-interactive inline-flex items-center rounded-2xl px-5 py-3 text-sm font-medium text-[var(--text-secondary)]"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
