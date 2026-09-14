import "server-only";

import { db } from "@/lib/db";
import { recalcCourseProgress } from "@/lib/progress";

/**
 * Server side of the SCORM runtime.
 *
 * Content commits an open-ended bag of CMI keys; this stores that bag verbatim
 * and lifts out the handful of values Lumina acts on. The important job is the
 * last one: translating a SCORM status into Lumina's own `LessonProgress`, so a
 * SCORM lesson counts toward course progress, certificates and the compliance
 * register exactly like a video does. Without that the package would play and
 * track, and none of it would reach the reporting anyone actually reads.
 *
 * The two versions name things differently, which is most of the work here:
 *
 *   1.2                          2004
 *   cmi.core.lesson_status       cmi.completion_status + cmi.success_status
 *   cmi.core.score.raw           cmi.score.raw
 *   cmi.core.lesson_location     cmi.location
 *   cmi.core.session_time        cmi.session_time   (different time formats)
 */

export type NormalisedStatus =
  | "not attempted"
  | "incomplete"
  | "completed"
  | "passed"
  | "failed";

export interface CommitInput {
  userId: string;
  lessonId: string;
  cmi: Record<string, string>;
}

function num(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 1.2 uses HHHH:MM:SS.SS; 2004 uses the ISO 8601 duration PT1H2M3S. Both turn up
 * malformed often enough that anything unparseable is worth zero rather than NaN.
 */
export function parseSessionTime(raw: string | undefined): number {
  if (!raw) return 0;
  const value = raw.trim();

  const iso = /^P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/i;
  const m = value.match(iso);
  if (m) {
    const [, y, mo, d, h, mi, s] = m.map((x) => (x ? Number(x) : 0)) as number[];
    return Math.round(
      (y || 0) * 31536000 + (mo || 0) * 2592000 + (d || 0) * 86400 +
      (h || 0) * 3600 + (mi || 0) * 60 + (s || 0)
    );
  }

  const hms = value.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (hms) {
    return Math.round(Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]));
  }

  return 0;
}

/**
 * 2004 splits completion from success, so a package can be finished and failed
 * at the same time. Lumina needs one word, and failure is the more informative
 * of the two — "completed but failed" reads as a pass in any list that only
 * shows completion.
 */
export function normaliseStatus(cmi: Record<string, string>): NormalisedStatus {
  const raw = (cmi["cmi.core.lesson_status"] ?? "").toLowerCase();
  if (raw) {
    if (raw === "passed") return "passed";
    if (raw === "failed") return "failed";
    if (raw === "completed") return "completed";
    if (raw === "incomplete" || raw === "browsed") return "incomplete";
    return "not attempted";
  }

  const success = (cmi["cmi.success_status"] ?? "").toLowerCase();
  const completion = (cmi["cmi.completion_status"] ?? "").toLowerCase();

  if (success === "failed") return "failed";
  if (success === "passed") return "passed";
  if (completion === "completed") return "completed";
  if (completion === "incomplete") return "incomplete";
  return "not attempted";
}

/** Whether a status means the learner is done, for Lumina's purposes. */
export function countsAsComplete(status: NormalisedStatus): boolean {
  return status === "completed" || status === "passed";
}

export function readScore(cmi: Record<string, string>) {
  return {
    raw: num(cmi["cmi.core.score.raw"] ?? cmi["cmi.score.raw"]),
    max: num(cmi["cmi.core.score.max"] ?? cmi["cmi.score.max"]),
    min: num(cmi["cmi.core.score.min"] ?? cmi["cmi.score.min"]),
  };
}

export async function commitScormState(input: CommitInput) {
  const { userId, lessonId, cmi } = input;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, type: true, section: { select: { courseId: true } } },
  });
  if (!lesson || lesson.type !== "SCORM") {
    throw new Error("Not a SCORM lesson.");
  }
  const courseId = lesson.section.courseId;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  // No enrollment means a preview viewer. The content still runs; nothing is
  // recorded against a course they have not joined.
  if (!enrollment) return { recorded: false as const };

  const reported = normaliseStatus(cmi);
  const reportedScore = readScore(cmi);
  const suspend = cmi["cmi.suspend_data"] ?? null;
  const location = cmi["cmi.core.lesson_location"] ?? cmi["cmi.location"] ?? null;
  const session = parseSessionTime(
    cmi["cmi.core.session_time"] ?? cmi["cmi.session_time"]
  );

  const previous = await db.scormState.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { totalTimeSeconds: true, lessonStatus: true, scoreRaw: true, scoreMax: true, scoreMin: true },
  });

  // Session time is the length of *this* attempt, so it accumulates rather than
  // replaces. Content that never reports it simply never adds to the total.
  const totalTimeSeconds = (previous?.totalTimeSeconds ?? 0) + session;

  /**
   * Completion is a high-water mark, and this is the whole reason:
   *
   * SCORM content sets `lesson_status` to "incomplete" on virtually every
   * re-entry — it is describing the session it has just started, not revoking
   * what happened last time. Writing that straight through means a learner who
   * finished mandatory training in March and reopens it in June is instantly
   * non-compliant, their completion date is gone, and course progress drops.
   *
   * So a status that counts as done can move between completed, passed and
   * failed, but never back to incomplete or not attempted. A retake can change
   * the grade; it cannot unfinish the lesson.
   */
  const wasComplete = countsAsComplete((previous?.lessonStatus ?? "not attempted") as NormalisedStatus);
  const status: NormalisedStatus =
    wasComplete && !countsAsComplete(reported) && reported !== "failed"
      ? (previous!.lessonStatus as NormalisedStatus)
      : reported;

  // Likewise a re-entry that reports no score should not erase the old one.
  const score = {
    raw: reportedScore.raw ?? previous?.scoreRaw ?? null,
    max: reportedScore.max ?? previous?.scoreMax ?? null,
    min: reportedScore.min ?? previous?.scoreMin ?? null,
  };

  await db.scormState.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      cmi: JSON.stringify(cmi),
      lessonStatus: status,
      scoreRaw: score.raw,
      scoreMax: score.max,
      scoreMin: score.min,
      suspendData: suspend,
      location,
      totalTimeSeconds,
    },
    update: {
      cmi: JSON.stringify(cmi),
      lessonStatus: status,
      scoreRaw: score.raw,
      scoreMax: score.max,
      scoreMin: score.min,
      suspendData: suspend,
      location,
      totalTimeSeconds,
    },
  });

  const complete = countsAsComplete(status);

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      enrollmentId: enrollment.id,
      secondsWatched: totalTimeSeconds,
      completed: complete,
      completedAt: complete ? new Date() : null,
    },
    update: {
      secondsWatched: totalTimeSeconds,
      // `completed` only ever goes false → true here, for the same reason the
      // status does not regress.
      ...(complete ? { completed: true } : {}),
    },
  });

  // Stamp the moment it was first finished, and never move it afterwards —
  // the compliance register cares when the training was done, not when it was
  // last opened.
  if (complete) {
    await db.lessonProgress.updateMany({
      where: { userId, lessonId, completedAt: null },
      data: { completedAt: new Date() },
    });
  }

  await recalcCourseProgress(userId, courseId);

  return { recorded: true as const, status, complete, totalTimeSeconds };
}

/** The state the player hands to the content when it initialises. */
export async function loadScormState(userId: string, lessonId: string) {
  const state = await db.scormState.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { cmi: true, lessonStatus: true, suspendData: true, location: true },
  });
  if (!state) return null;

  let cmi: Record<string, string> = {};
  try {
    const parsed = JSON.parse(state.cmi);
    if (parsed && typeof parsed === "object") cmi = parsed as Record<string, string>;
  } catch {
    // A corrupt blob should cost the learner their bookmark, not the lesson.
  }

  return {
    cmi,
    lessonStatus: state.lessonStatus,
    suspendData: state.suspendData,
    location: state.location,
  };
}
