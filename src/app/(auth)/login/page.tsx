import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, KeyRound } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { oidcConfig } from "@/lib/providers/oidc-client";
import { SSO_ERROR_MESSAGES } from "@/lib/providers/oidc-transaction";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const selfServiceEnabled = process.env.AUTH_ALLOW_SELF_REGISTRATION !== "false";
  const sso = oidcConfig();

  // Only render a message we wrote. Echoing an arbitrary `?error=` back into the
  // page would let anyone put text of their choosing on the sign-in screen.
  const ssoError = params.error
    ? SSO_ERROR_MESSAGES[params.error] ?? SSO_ERROR_MESSAGES.sso_failed
    : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Welcome back
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Sign in to pick up where you left off.
        </p>
      </div>

      {params.registered && (
        <div className="mb-6 rounded-2xl bg-[color-mix(in_srgb,var(--success)_12%,transparent)] p-4 text-sm text-[var(--success)]">
          Account created. Sign in to continue.
        </div>
      )}

      {ssoError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{ssoError}</span>
        </div>
      )}

      {sso && (
        <div className="mb-6">
          {/*
            A real form navigation, not a <Link>: the target is a route handler
            that redirects to another origin, which client-side routing cannot
            follow.
          */}
          <form action="/api/auth/sso" method="get">
            {params.next && <input type="hidden" name="next" value={params.next} />}
            <Button type="submit" variant="secondary" size="lg" fullWidth>
              <KeyRound className="h-4 w-4" aria-hidden />
              {sso.buttonLabel}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              or
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        </div>
      )}

      <LoginForm next={params.next} />

      {selfServiceEnabled && (
        <p className="mt-8 text-center text-sm text-[var(--text-muted)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
