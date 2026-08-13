/**
 * Helpers for the JSON-encoded string columns (course objectives, tags, quiz
 * answer maps). Keeping the parse in one place means a malformed row degrades to
 * an empty value instead of crashing a page render.
 */

export function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function stringifyStringArray(value: string[] | undefined | null): string {
  if (!value) return "[]";
  return JSON.stringify(value.map((v) => v.trim()).filter(Boolean));
}

export function parseAnswerMap(
  value: string | null | undefined
): Record<string, string[]> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (Array.isArray(val)) {
        out[key] = val.filter((v): v is string => typeof v === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Splits a textarea into a clean list — one item per non-empty line. */
export function linesToArray(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Splits a comma-separated tag input into a deduped list. */
export function csvToArray(text: string | null | undefined): string[] {
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}
