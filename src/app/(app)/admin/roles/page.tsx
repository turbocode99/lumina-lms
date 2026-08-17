import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Check, Minus, ShieldCheck, Users } from "lucide-react";

import { RoleBadge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/enums";
import {
  permissionsByGroup,
  roleHas,
  ROLE_SUMMARY,
  type Role,
} from "@/lib/permissions";
import { requireAdmin } from "@/lib/rbac";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Roles & permissions" };
export const dynamic = "force-dynamic";

const SCOPE_NOTE = {
  all: null,
  own: "own records only",
  enrolled: "when enrolled",
} as const;

/**
 * Activity meta is stored as a JSON string. Render the parts that are meaningful
 * to a human rather than dumping the raw object into the page.
 */
function describeMeta(meta: string | null): string {
  if (!meta) return "";
  try {
    const parsed = JSON.parse(meta) as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof parsed.role === "string") parts.push(`role → ${parsed.role}`);
    if (parsed.isActive === false) parts.push("deactivated");
    if (parsed.isActive === true) parts.push("active");
    if (typeof parsed.count === "number") parts.push(`${parsed.count} people`);
    return parts.length ? ` · ${parts.join(", ")}` : "";
  } catch {
    return "";
  }
}

/**
 * Roles & permissions console.
 *
 * The matrix is generated from `src/lib/permissions.ts`, which is the same model
 * the guards check against — so it cannot drift from what is actually enforced. A
 * hand-written table would be reassuring and eventually wrong.
 */
export default async function AdminRolesPage() {
  await requireAdmin("/admin/roles");

  const groups = permissionsByGroup();

  const [counts, recentRoleChanges] = await Promise.all([
    db.user.groupBy({
      by: ["role"],
      _count: { role: true },
      where: { isActive: true },
    }),
    db.activityLog.findMany({
      where: { action: { in: ["user.update", "user.create", "user.password_reset"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const countFor = (role: Role) =>
    counts.find((c) => c.role === role)?._count.role ?? 0;

  const inactiveCount = await db.user.count({ where: { isActive: false } });

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header>
        <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          <ShieldCheck className="h-7 w-7 text-[var(--accent)]" />
          Roles &amp; permissions
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
          What each role can do, generated from the permission model the
          application actually enforces. Roles are hierarchical — each one includes
          everything below it.
        </p>
      </header>

      {/* Roles */}
      <div className="grid gap-4 md:grid-cols-3">
        {ROLES.map((role) => (
          <Card key={role} elevation="sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <RoleBadge role={role} />
              <Link
                href={`/admin/users?role=${role}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                <Users className="h-3.5 w-3.5" />
                {countFor(role)} active
              </Link>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {ROLE_SUMMARY[role].summary}
            </p>
          </Card>
        ))}
      </div>

      {inactiveCount > 0 && (
        <Card elevation="sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">{inactiveCount}</strong>{" "}
              deactivated {inactiveCount === 1 ? "account" : "accounts"}. Deactivated
              users cannot sign in, and any existing session stops working on their
              next request.
            </span>
            <Link
              href="/admin/users?status=inactive"
              className="ml-auto text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              Review →
            </Link>
          </div>
        </Card>
      )}

      {/* Matrix */}
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] p-5">
          <CardTitle>Permission matrix</CardTitle>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            A tick means the role holds the permission. Some are limited in scope
            even when held — an instructor may edit courses, but only their own.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Permission
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
                  >
                    {ROLE_SUMMARY[role].label}
                  </th>
                ))}
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Enforced by
                </th>
              </tr>
            </thead>

            <tbody>
              {groups.map((group) => (
                <Fragment key={group.group}>
                  <tr className="bg-[var(--surface-sunken)]">
                    <td
                      colSpan={ROLES.length + 2}
                      className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                      {group.group}
                    </td>
                  </tr>

                  {group.permissions.map((permission) => (
                    <tr
                      key={permission.key}
                      className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-raised)]"
                    >
                      <td className="px-5 py-3">
                        <p className="text-[var(--text-primary)]">
                          {permission.label}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                          {permission.key}
                        </p>
                      </td>

                      {ROLES.map((role) => {
                        const held = roleHas(role, permission.key);
                        const note = SCOPE_NOTE[permission.scope];
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            {held ? (
                              <span className="inline-flex flex-col items-center gap-1">
                                <Check className="h-4 w-4 text-[var(--success)]" />
                                {note && role !== "ADMIN" && (
                                  <span className="text-[10px] leading-tight text-[var(--text-muted)]">
                                    {note}
                                  </span>
                                )}
                                {note === "own records only" &&
                                  role === "ADMIN" && (
                                    <span className="text-[10px] leading-tight text-[var(--text-muted)]">
                                      any
                                    </span>
                                  )}
                              </span>
                            ) : (
                              <Minus className="mx-auto h-4 w-4 text-[var(--text-muted)] opacity-30" />
                            )}
                          </td>
                        );
                      })}

                      <td className="px-5 py-3">
                        <code className="text-[11px] text-[var(--text-muted)]">
                          {permission.enforcedBy}
                        </code>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* How enforcement works */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">How access is enforced</CardTitle>
          <ul className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            <li>
              <strong className="text-[var(--text-primary)]">
                The database decides, not the session.
              </strong>{" "}
              The cookie carries a role, but every request re-reads the user row —
              so a role change or deactivation applies on the very next request,
              and a token claiming a higher role than the account holds is ignored.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">
                Every write is guarded server-side.
              </strong>{" "}
              Hiding a button is presentation, not security. Each server action
              re-checks the caller before touching data.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">
                Ownership is separate from role.
              </strong>{" "}
              Instructors are limited to courses they created; only administrators
              act across all of them.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">
                Lesson media requires a session.
              </strong>{" "}
              Video and resources stream through an authenticated route, so a URL
              alone is not access.
            </li>
          </ul>
        </Card>

        <Card>
          <CardTitle className="mb-3">Recent access changes</CardTitle>
          {recentRoleChanges.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              No role or account changes recorded yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {recentRoleChanges.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-2.5 last:border-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-[var(--text-primary)]">
                      {entry.user.name}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {entry.action.replace(/[._]/g, " ")}
                      {describeMeta(entry.meta)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {formatRelative(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Link
              href="/admin/users"
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Manage people and roles →
            </Link>
          </div>
        </Card>
      </div>

      <Card elevation="sm">
        <p className="text-sm text-[var(--text-muted)]">
          Permissions are defined in{" "}
          <code className="text-[var(--text-secondary)]">src/lib/permissions.ts</code>{" "}
          and this table is generated from it, so it always reflects what the
          application enforces. Changing a role&apos;s capabilities means editing
          that file — there is no separate configuration to keep in step.
        </p>
      </Card>
    </div>
  );
}
