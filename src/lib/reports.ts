import "server-only";

import { db } from "@/lib/db";
import type { CsvColumn } from "@/lib/csv";

/**
 * Compliance exports.
 *
 * Each report is a column list plus a paged query. The admin screens cap their
 * tables (150 assignments, 200 certificates) because nobody scrolls further
 * than that — which is exactly why an export has to exist, and exactly why it
 * must not inherit the cap. These read the whole set, in pages, so the response
 * can stream rather than assembling an entire year of records in memory first.
 */

const PAGE_SIZE = 500;

export const REPORTS = ["assignments", "enrollments", "certificates"] as const;
export type ReportName = (typeof REPORTS)[number];

export function isReportName(value: string): value is ReportName {
  return (REPORTS as readonly string[]).includes(value);
}

export interface ReportDefinition<Row> {
  /** Used for the download filename. */
  slug: string;
  columns: readonly CsvColumn<Row>[];
  /** Yields rows in pages so the route can stream them out. */
  pages(filters: ReportFilters): AsyncGenerator<Row[]>;
}

export interface ReportFilters {
  /** Matches the `?status=` filter on the required-training register. */
  status?: string | null;
}

// --- Required training -----------------------------------------------------

type AssignmentRow = {
  user: { name: string; email: string; department: string | null };
  assignedBy: { name: string };
  course: { title: string } | null;
  path: { title: string } | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  note: string | null;
};

/**
 * The same three words the register shows, derived the same way, so an export
 * and the screen it was taken from never disagree.
 */
function assignmentStatus(row: AssignmentRow, now: Date): string {
  if (row.completedAt) return "Completed";
  if (row.dueAt && row.dueAt < now) return "Overdue";
  return "Open";
}

function daysOverdue(row: AssignmentRow, now: Date): number | null {
  if (row.completedAt || !row.dueAt || row.dueAt >= now) return null;
  return Math.floor((now.getTime() - row.dueAt.getTime()) / 86_400_000);
}

const assignments: ReportDefinition<AssignmentRow> = {
  slug: "required-training",
  columns: [
    { header: "Name", value: (r) => r.user.name },
    { header: "Email", value: (r) => r.user.email },
    { header: "Department", value: (r) => r.user.department },
    { header: "Type", value: (r) => (r.course ? "Course" : "Learning path") },
    { header: "Title", value: (r) => r.course?.title ?? r.path?.title ?? "" },
    { header: "Status", value: (r) => assignmentStatus(r, new Date()) },
    { header: "Due", value: (r) => r.dueAt },
    { header: "Days overdue", value: (r) => daysOverdue(r, new Date()) },
    { header: "Completed", value: (r) => r.completedAt },
    { header: "Assigned by", value: (r) => r.assignedBy.name },
    { header: "Assigned on", value: (r) => r.createdAt },
    { header: "Note", value: (r) => r.note },
  ],
  async *pages(filters) {
    const now = new Date();
    const where =
      filters.status === "open"
        ? { completedAt: null }
        : filters.status === "overdue"
          ? { completedAt: null, dueAt: { lt: now } }
          : filters.status === "completed"
            ? { completedAt: { not: null } }
            : {};

    for (let skip = 0; ; skip += PAGE_SIZE) {
      const rows = await db.assignment.findMany({
        where,
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        skip,
        take: PAGE_SIZE,
        select: {
          dueAt: true,
          completedAt: true,
          createdAt: true,
          note: true,
          user: { select: { name: true, email: true, department: true } },
          assignedBy: { select: { name: true } },
          course: { select: { title: true } },
          path: { select: { title: true } },
        },
      });
      if (!rows.length) return;
      yield rows;
      if (rows.length < PAGE_SIZE) return;
    }
  },
};

// --- Enrollments and progress ----------------------------------------------

type EnrollmentRow = {
  user: { name: string; email: string; department: string | null };
  course: { title: string; category: { name: string } | null };
  source: string;
  progressPercent: number;
  enrolledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

const enrollments: ReportDefinition<EnrollmentRow> = {
  slug: "enrollments",
  columns: [
    { header: "Name", value: (r) => r.user.name },
    { header: "Email", value: (r) => r.user.email },
    { header: "Department", value: (r) => r.user.department },
    { header: "Course", value: (r) => r.course.title },
    { header: "Category", value: (r) => r.course.category?.name },
    { header: "Source", value: (r) => r.source },
    { header: "Progress %", value: (r) => r.progressPercent },
    { header: "Completed", value: (r) => Boolean(r.completedAt) },
    { header: "Enrolled on", value: (r) => r.enrolledAt },
    { header: "Started", value: (r) => r.startedAt },
    { header: "Completed on", value: (r) => r.completedAt },
  ],
  async *pages() {
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const rows = await db.enrollment.findMany({
        orderBy: { enrolledAt: "asc" },
        skip,
        take: PAGE_SIZE,
        select: {
          source: true,
          progressPercent: true,
          enrolledAt: true,
          startedAt: true,
          completedAt: true,
          user: { select: { name: true, email: true, department: true } },
          course: {
            select: { title: true, category: { select: { name: true } } },
          },
        },
      });
      if (!rows.length) return;
      yield rows;
      if (rows.length < PAGE_SIZE) return;
    }
  },
};

// --- Certificates ----------------------------------------------------------

type CertificateRow = {
  serial: string;
  title: string;
  issuedAt: Date;
  user: { name: string; email: string; department: string | null };
  course: { title: string } | null;
  path: { title: string } | null;
};

const certificates: ReportDefinition<CertificateRow> = {
  slug: "certificates",
  columns: [
    { header: "Serial", value: (r) => r.serial },
    { header: "Name", value: (r) => r.user.name },
    { header: "Email", value: (r) => r.user.email },
    { header: "Department", value: (r) => r.user.department },
    { header: "Type", value: (r) => (r.course ? "Course" : "Learning path") },
    { header: "Title", value: (r) => r.title },
    { header: "Issued on", value: (r) => r.issuedAt },
  ],
  async *pages() {
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const rows = await db.certificate.findMany({
        orderBy: { issuedAt: "asc" },
        skip,
        take: PAGE_SIZE,
        select: {
          serial: true,
          title: true,
          issuedAt: true,
          user: { select: { name: true, email: true, department: true } },
          course: { select: { title: true } },
          path: { select: { title: true } },
        },
      });
      if (!rows.length) return;
      yield rows;
      if (rows.length < PAGE_SIZE) return;
    }
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REPORT_DEFINITIONS: Record<ReportName, ReportDefinition<any>> = {
  assignments,
  enrollments,
  certificates,
};
