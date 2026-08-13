import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award } from "lucide-react";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Certificate" };
export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!luminaConfig.features.certificates) notFound();

  const { id } = await params;
  const user = await requireUser();

  const certificate = await db.certificate.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, title: true, department: true } },
      course: {
        select: {
          title: true,
          durationMinutes: true,
          instructor: { select: { name: true } },
        },
      },
      path: { select: { title: true, color: true } },
    },
  });

  if (!certificate) notFound();

  // A certificate is private to its owner; admins can view any for audit.
  if (certificate.userId !== user.id && user.role !== "ADMIN") notFound();

  const accent = certificate.path?.color ?? "var(--accent)";

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <Link
          href="/certificates"
          className="neu-interactive flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          All certificates
        </Link>
        <PrintButton />
      </div>

      {/* The certificate itself. Border and layout are print-safe. */}
      <div className="neu-lg relative overflow-hidden rounded-[var(--radius-neu-lg)] p-8 sm:p-14">
        <span
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-10 blur-3xl"
          style={{ background: accent }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full opacity-10 blur-3xl"
          style={{ background: "var(--secondary)" }}
          aria-hidden
        />

        <div
          className="relative rounded-[var(--radius-neu)] border-2 px-6 py-10 text-center sm:px-12 sm:py-14"
          style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)` }}
        >
          <span
            className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 50%, var(--secondary)))`,
            }}
          >
            <Award className="h-10 w-10 text-white" />
          </span>

          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Certificate of Completion
          </p>

          <p className="mt-8 text-sm text-[var(--text-muted)]">
            This certifies that
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            {certificate.user.name}
          </h1>
          {(certificate.user.title || certificate.user.department) && (
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              {[certificate.user.title, certificate.user.department]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          <p className="mt-8 text-sm text-[var(--text-muted)]">
            has successfully completed
          </p>
          <h2 className="mx-auto mt-2 max-w-2xl text-xl font-semibold leading-snug text-[var(--text-primary)] sm:text-3xl">
            {certificate.title}
          </h2>

          {certificate.course && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {Math.round(certificate.course.durationMinutes / 60) > 0
                ? `${Math.round(certificate.course.durationMinutes / 60)} hours of instruction`
                : `${certificate.course.durationMinutes} minutes of instruction`}
              {certificate.course.instructor &&
                ` · Instructor: ${certificate.course.instructor.name}`}
            </p>
          )}
          {certificate.path && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Learning path
            </p>
          )}

          <div className="mx-auto mt-12 grid max-w-2xl gap-8 border-t border-[var(--border-subtle)] pt-8 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Issued
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                {formatDate(certificate.issuedAt)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Verification code
              </p>
              <p className="mt-1 font-mono text-sm font-medium tracking-wider text-[var(--text-primary)]">
                {certificate.serial}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Issued by
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                {luminaConfig.brand.certificateAuthority}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {luminaConfig.brand.organization}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="no-print mt-6 text-center text-xs text-[var(--text-muted)]">
        Verify this certificate by quoting code{" "}
        <span className="font-mono font-semibold">{certificate.serial}</span> to{" "}
        {luminaConfig.brand.certificateAuthority}.
      </p>
    </div>
  );
}
