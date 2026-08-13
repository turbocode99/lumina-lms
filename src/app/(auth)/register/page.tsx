import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  if (process.env.AUTH_ALLOW_SELF_REGISTRATION === "false") {
    redirect("/login");
  }

  // Tell the very first visitor that this account will own the instance.
  const isFirstAccount = (await db.user.count()) === 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Create your account
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Takes about thirty seconds.
        </p>
      </div>

      {isFirstAccount && (
        <div className="mb-6 rounded-2xl bg-[color-mix(in_srgb,var(--info)_12%,transparent)] p-4 text-sm text-[var(--info)]">
          <strong className="font-semibold">First account.</strong> You&apos;ll be
          made an administrator so you can set up the platform.
        </div>
      )}

      <RegisterForm />

      <p className="mt-8 text-center text-sm text-[var(--text-muted)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--accent)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
