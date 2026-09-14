import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { commitScormState, loadScormState } from "@/lib/scorm/runtime";

/**
 * Where the SCORM API shim reads and writes runtime state.
 *
 * A route rather than a server action because the content calls `LMSCommit` and
 * `LMSFinish` at moments we do not control — including during `beforeunload`,
 * where the only thing with a chance of completing is `navigator.sendBeacon`,
 * and a beacon can only post to a URL.
 */

export const dynamic = "force-dynamic";

/** Both lesson and package are checked, so a lesson id cannot be swapped in. */
async function resolveLesson(packageId: string, lessonId: string) {
  if (!lessonId) return null;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, type: true, scormPackageId: true },
  });
  if (!lesson || lesson.type !== "SCORM" || lesson.scormPackageId !== packageId) {
    return null;
  }
  return lesson;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ packageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packageId } = await context.params;
  const lessonId = request.nextUrl.searchParams.get("lessonId") ?? "";

  const lesson = await resolveLesson(packageId, lessonId);
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const state = await loadScormState(user.id, lesson.id);
  return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ packageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packageId } = await context.params;

  let body: { lessonId?: string; cmi?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const lesson = await resolveLesson(packageId, String(body.lessonId ?? ""));
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The CMI model is string-valued. Coercing here keeps anything odd the content
  // sends from reaching the database as a nested object.
  const cmi: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.cmi ?? {})) {
    if (typeof key !== "string" || key.length > 250) continue;
    if (value === null || value === undefined) continue;
    const str = typeof value === "string" ? value : String(value);
    // suspend_data is allowed to be large — 2004 permits 64KB — but not endless.
    if (str.length > 65536) continue;
    cmi[key] = str;
  }

  try {
    const result = await commitScormState({ userId: user.id, lessonId: lesson.id, cmi });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[scorm] commit failed:", error);
    return NextResponse.json({ error: "Commit failed" }, { status: 500 });
  }
}
