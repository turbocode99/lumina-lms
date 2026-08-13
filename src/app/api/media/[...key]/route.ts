import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";

/**
 * Streams stored media (lesson video, thumbnails, resources).
 *
 * Excluded from the middleware matcher so it can handle its own auth: media is
 * only served to signed-in users, and video needs HTTP range support for
 * seeking, which a redirect-based flow would break.
 */

export const dynamic = "force-dynamic";

function parseRange(header: string | null, ): { start: number; end?: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === "") return null; // suffix ranges ("-500") aren't used by browsers here
  const start = Number(rawStart);
  if (!Number.isFinite(start) || start < 0) return null;

  const end = rawEnd === "" ? undefined : Number(rawEnd);
  if (end !== undefined && (!Number.isFinite(end) || end < start)) return null;

  return { start, end };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { key: segments } = await context.params;
  // Path traversal is rejected inside the storage driver, which resolves every
  // key against the storage root before touching the filesystem.
  const key = segments.map((s) => decodeURIComponent(s)).join("/");

  const range = parseRange(request.headers.get("range"));

  const object = await storage.get(key, range ?? undefined);
  if (!object) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": object.contentType,
    "Content-Length": String(object.size),
    "Accept-Ranges": "bytes",
    // Media is immutable once written (keys are content-addressed by nanoid),
    // but it's per-user gated, so keep it out of shared caches.
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });

  if (object.range) {
    headers.set(
      "Content-Range",
      `bytes ${object.range.start}-${object.range.end}/${object.range.total}`
    );
    return new NextResponse(object.stream, { status: 206, headers });
  }

  return new NextResponse(object.stream, { status: 200, headers });
}
