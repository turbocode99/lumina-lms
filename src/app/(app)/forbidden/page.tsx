import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";

import { RoleBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/rbac";
import { ROLE_SUMMARY, type Role } from "@/lib/permissions";
import { ROLES } from "@/lib/enums";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Access denied" };
export const dynamic = "force-dynamic";

/**
 * 403 page.
 *
 * Blocked users used to be redirected to `/dashboard?error=forbidden`, which the
 * dashboard never read — so the refusal was completely silent and looked like the
 * link was broken. This says what was refused, why, and what to do about it.
 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; required?: string }>;
}) {
  const user = await requireUser();
  const { reason, required } = await searchParams;

  const requiredRole = ROLES.includes(required as Role) ? (required as Role) : null;

  const explanation =
    reason === "ownership"
      ? {
          title: "That course belongs to someone else",
          body: "Instructors can only edit courses they created. An administrator can edit any course, or transfer this one to you.",
        }
      : requiredRole
        ? {
            title: `This area needs the ${ROLE_SUMMARY[requiredRole].label} role`,
            body: ROLE_SUMMARY[requiredRole].summary,
          }
        : {
            title: "You don't have access to that",
            body: "Your role doesn't include this area. If you think it should, ask an administrator to review your permissions.",
          };

  return (
    <div className="mx-auto max-w-[720px] py-8">
      <Card elevation="lg" className="text-center">
        <span className="neu-inset mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full text-[var(--warning)]">
          {reason === "ownership" ? (
            <Lock className="h-9 w-9" />
          ) : (
            <ShieldAlert className="h-9 w-9" />
          )}
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {explanation.title}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
          {explanation.body}
        </p>

        <div className="neu-inset mx-auto mt-7 flex max-w-sm flex-col gap-3 rounded-2xl p-5 text-left">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Signed in as
            </span>
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">
              {user.email}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Your role
            </span>
            <RoleBadge role={user.role} />
          </div>
          {requiredRole && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Required
              </span>
              <RoleBadge role={requiredRole} />
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/dashboard" variant="primary">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </ButtonLink>
          <ButtonLink href="/catalog">Browse catalog</ButtonLink>
        </div>

        <p className="mt-6 text-xs text-[var(--text-muted)]">
          Need access? Contact{" "}
          <Link
            href={`mailto:${luminaConfig.brand.supportEmail}`}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            {luminaConfig.brand.supportEmail}
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
