import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  if (!luminaConfig.features.certificates) notFound();
  const user = await requireUser("/certificates");

  const certificates = await db.certificate.findMany({
    where: { userId: user.id },
    orderBy: { issuedAt: "desc" },
    include: {
      course: { select: { slug: true, durationMinutes: true } },
      path: { select: { slug: true, color: true } },
    },
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Certificates
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Proof of everything you&apos;ve completed. Each one carries a unique
          verification code.
        </p>
      </header>

      {certificates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Award className="h-9 w-9" />}
            title="No certificates yet"
            description="Finish a course or learning path and your certificate is issued automatically."
            action={{ label: "Browse catalog", href: "/catalog" }}
          />
        </Card>
      ) : (
        <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((certificate) => {
            const accent = certificate.path?.color ?? "var(--accent)";
            return (
              <Link
                key={certificate.id}
                href={`/certificates/${certificate.id}`}
                className="neu-interactive group relative overflow-hidden rounded-[var(--radius-neu)] p-6"
              >
                <span
                  className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-30"
                  style={{ background: accent }}
                  aria-hidden
                />

                <span
                  className="neu-inset relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ color: accent }}
                >
                  <Award className="h-7 w-7" />
                </span>

                <h2 className="relative line-clamp-2 font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                  {certificate.title}
                </h2>

                <p className="relative mt-1.5 text-xs text-[var(--text-muted)]">
                  {certificate.path ? "Learning path" : "Course"} · Issued{" "}
                  {formatDate(certificate.issuedAt)}
                </p>

                <p className="relative mt-4 font-mono text-[11px] tracking-wider text-[var(--text-muted)]">
                  {certificate.serial}
                </p>

                <span className="relative mt-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
                  View certificate
                  <ExternalLink className="h-3 w-3" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
