import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Route, Search } from "lucide-react";

import { ExportButton } from "@/components/admin/ExportButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

/**
 * Org-wide certificate register. Learners can see their own certificates, but
 * there was no way for an administrator to answer "who has completed this
 * training?" without querying the database directly — which is the whole point of
 * tracking compliance training in the first place.
 */
export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!luminaConfig.features.certificates) notFound();
  await requireAdmin("/admin/certificates");

  const { q } = await searchParams;
  const needle = q?.trim();

  const where = needle
    ? {
        OR: [
          { title: { contains: needle } },
          { serial: { contains: needle } },
          { user: { name: { contains: needle } } },
          { user: { email: { contains: needle } } },
          { user: { department: { contains: needle } } },
        ],
      }
    : {};

  const [certificates, total, courseCount, pathCount] = await Promise.all([
    db.certificate.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      take: 200,
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true, department: true },
        },
        course: { select: { slug: true } },
        path: { select: { slug: true, color: true } },
      },
    }),
    db.certificate.count(),
    db.certificate.count({ where: { courseId: { not: null } } }),
    db.certificate.count({ where: { pathId: { not: null } } }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Certificates
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Every certificate issued across {luminaConfig.brand.organization}.
          </p>
        </div>

        <ExportButton report="certificates" />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total issued"
          value={total}
          icon={<Award className="h-5 w-5" />}
          accent="var(--warning)"
        />
        <StatCard
          label="From courses"
          value={courseCount}
          icon={<Award className="h-5 w-5" />}
        />
        <StatCard
          label="From paths"
          value={pathCount}
          icon={<Route className="h-5 w-5" />}
          accent="var(--secondary)"
        />
      </div>

      {/* Search is a plain GET form so results stay server-rendered and linkable. */}
      <Card>
        <form method="get" className="flex flex-wrap gap-3">
          <div className="neu-inset neu-input flex min-w-[240px] flex-1 items-center gap-2.5 rounded-2xl px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <input
              name="q"
              defaultValue={needle ?? ""}
              placeholder="Search by person, department, course, or serial…"
              aria-label="Search certificates"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <button
            type="submit"
            className="neu-accent rounded-2xl px-5 text-sm font-semibold"
          >
            Search
          </button>
          {needle && (
            <Link
              href="/admin/certificates"
              className="neu-interactive flex items-center rounded-2xl px-5 text-sm font-medium text-[var(--text-secondary)]"
            >
              Clear
            </Link>
          )}
        </form>
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] p-5">
          <CardTitle>
            {needle ? `Results for "${needle}"` : "Recently issued"}
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {certificates.length === 200
              ? "Showing the most recent 200."
              : `${certificates.length} of ${total}.`}
          </p>
        </div>

        {certificates.length === 0 ? (
          <EmptyState
            icon={<Award className="h-9 w-9" />}
            title={needle ? "Nothing matches that search" : "No certificates issued yet"}
            description={
              needle
                ? "Try a different name, department, course, or serial number."
                : "Certificates are issued automatically when someone completes a course or learning path."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  {["Person", "Achievement", "Issued", "Serial", ""].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {certificates.map((certificate) => (
                  <tr
                    key={certificate.id}
                    className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--surface-raised)]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={certificate.user.name}
                          src={certificate.user.avatarUrl}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-primary)]">
                            {certificate.user.name}
                          </p>
                          <p className="truncate text-xs text-[var(--text-muted)]">
                            {certificate.user.department ?? certificate.user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {certificate.path && (
                          <Route
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: certificate.path.color }}
                          />
                        )}
                        <span className="text-[var(--text-secondary)]">
                          {certificate.title}
                        </span>
                        <Badge tone={certificate.path ? "accent" : "outline"}>
                          {certificate.path ? "Path" : "Course"}
                        </Badge>
                      </div>
                    </td>

                    <td className="px-5 py-3 text-xs text-[var(--text-muted)]">
                      {formatDate(certificate.issuedAt)}
                    </td>

                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-muted)]">
                      {certificate.serial}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/certificates/${certificate.id}`}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
