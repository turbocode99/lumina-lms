import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * Liveness/readiness probe for Docker, Kubernetes, and load balancers.
 *
 * Deliberately unauthenticated and deliberately thin: it confirms the process
 * is up and the database is reachable, and returns nothing that would be useful
 * to an unauthenticated caller beyond that.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "error", detail: "database unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
