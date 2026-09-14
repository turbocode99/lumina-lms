import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { contentTypeFor } from "@/lib/scorm/import";

/**
 * Serves the files of an imported SCORM package.
 *
 * A package is a small website — HTML that pulls its own JavaScript, CSS, media
 * and fonts by relative path — so this has to serve arbitrary paths under one
 * prefix rather than a single object like the media route does.
 *
 * Access is the same rule the player uses: signed in, and either enrolled, the
 * course author, an admin, or looking at a lesson marked as preview. The check
 * runs per file rather than only at launch, because the iframe fetches each
 * asset itself and an unauthenticated request for `assets/quiz-answers.js` is
 * exactly as interesting to an attacker as the launch page.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ packageId: string; path: string[] }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { packageId, path: segments } = await context.params;

  const pkg = await db.scormPackage.findUnique({
    where: { id: packageId },
    select: {
      storageKey: true,
      lessons: {
        select: {
          id: true,
          isPreview: true,
          section: { select: { course: { select: { id: true, instructorId: true } } } },
        },
      },
    },
  });
  if (!pkg || !pkg.storageKey) return new NextResponse("Not found", { status: 404 });

  // A package with no lesson is an orphan from a failed import; nobody may read it.
  if (!pkg.lessons.length) return new NextResponse("Not found", { status: 404 });

  let allowed = user.role === "ADMIN";
  if (!allowed) {
    for (const lesson of pkg.lessons) {
      const course = lesson.section.course;
      if (course.instructorId === user.id || lesson.isPreview) { allowed = true; break; }
      const enrolment = await db.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        select: { id: true },
      });
      if (enrolment) { allowed = true; break; }
    }
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const rel = segments.map((s) => decodeURIComponent(s)).join("/");
  // Traversal is rejected inside the storage driver, which resolves every key
  // against the storage root before touching the filesystem.
  const object = await storage.get(`${pkg.storageKey}/${rel}`);
  if (!object) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(object.stream, {
    headers: {
      // The driver guesses from the extension too, but SCORM leans on exact
      // types more than most content: a mislabelled .js stops the course dead.
      "Content-Type": contentTypeFor(rel) || object.contentType,
      "Content-Length": String(object.size),
      // Package files are immutable once imported — a new import gets a new id.
      "Cache-Control": "private, max-age=3600",
      // The content runs in an iframe on our own origin and must not be framed
      // by anyone else's site.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
