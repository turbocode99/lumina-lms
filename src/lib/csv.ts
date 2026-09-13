/**
 * CSV serialization for the compliance exports.
 *
 * Two things here are less obvious than they look.
 *
 * Quoting is the easy half: a field containing a comma, a quote, or a newline
 * has to be wrapped and its quotes doubled. Course titles and assignment notes
 * are free text written by instructors, so all three turn up in practice.
 *
 * Formula injection is the other half. A spreadsheet treats a cell beginning
 * `=`, `+`, `-`, or `@` as a formula, so a course titled `=HYPERLINK(...)` runs
 * when an administrator opens the export — the file is trusted, it came from
 * their own LMS. Prefixing those with an apostrophe makes the cell literal.
 * Numbers are written as numbers and never go through that guard, so a negative
 * value stays negative rather than turning into text.
 */

export type CsvValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn<Row> {
  /** Header text, written verbatim as the first line. */
  header: string;
  value: (row: Row) => CsvValue;
}

const NEEDS_QUOTING = /[",\r\n]/;
const RISKY_PREFIX = /^[=+\-@\t\r]/;

function serialize(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (value instanceof Date) {
    // ISO 8601, kept to the millisecond. A compliance export should not quietly
    // drop precision, and unlike a locale format it cannot be misread as
    // day/month in one country and month/day in another.
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  const text = RISKY_PREFIX.test(value) ? `'${value}` : value;
  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvHeaderRow<Row>(columns: readonly CsvColumn<Row>[]): string {
  return columns.map((column) => serialize(column.header)).join(",") + "\r\n";
}

export function csvRow<Row>(
  columns: readonly CsvColumn<Row>[],
  row: Row
): string {
  return columns.map((column) => serialize(column.value(row))).join(",") + "\r\n";
}

/**
 * Excel assumes the system code page unless a file opens with a byte order
 * mark, which turns every non-ASCII name in the export into mojibake. One
 * three-byte prefix avoids a support ticket from anyone called Chloé.
 */
export const CSV_BOM = "﻿";

/** RFC 4180 says CRLF, and it is what Excel on Windows expects. */
export const CSV_EOL = "\r\n";
