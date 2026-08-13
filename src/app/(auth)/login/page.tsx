import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const selfServiceEnabled = process.env.AUTH_ALLOW_SELF_REGISTRATION !== "false";

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
