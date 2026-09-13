import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { atLeast } from "@/lib/rbac";
import { logActivity } from "@/lib/notify";
import { CSV_BOM, csvHeaderRow, csvRow } from "@/lib/csv";
import { REPORT_DEFINITIONS, isReportName } from "@/lib/reports";

/**
 * Compliance exports as CSV.
 *
 * A route handler rather than a server action because the result is a file:
 * actions return data to the client, and getting a download out of one means
 * round-tripping the whole report through the page. Here the browser follows a
 * link and the response streams straight to disk.
 *
 * Authorization is checked here rather than delegated to `requireAdmin`, which
 * redirects — right for a page, wrong for something scripted against, where a
 * 403 is the honest answer and a 302 to an HTML login page is not.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ report: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!atLeast(user.role, "ADMIN")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { report } = await context.params;
  if (!isReportName(report)) {
    return new NextResponse("Unknown report", { status: 404 });
  }

  const definition = REPORT_DEFINITIONS[report];
  const status = request.nextUrl.searchParams.get("status");

  // Exports carry names, emails, and departments out of the system, so who took
  // one is worth recording next to every other admin action.
  await logActivity({
    userId: user.id,
    action: "report.export",
    entity: "report",
    entityId: report,
    meta: status ? { status } : null,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(CSV_BOM + csvHeaderRow(definition.columns)));

        for await (const page of definition.pages({ status })) {
          let chunk = "";
          for (const row of page) chunk += csvRow(definition.columns, row);
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        // The response has already begun, so there is no status code left to
        // change. Log it, and end the file rather than leaving the download
        // hanging until it times out — a short CSV is at least diagnosable.
        console.error(`[lumina] export "${report}" failed mid-stream:`, error);
      } finally {
        controller.close();
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = status ? `-${status}` : "";
  const filename = `lumina-${definition.slug}${suffix}-${stamp}.csv`;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // These contain staff records; nothing between here and the browser
      // should keep a copy.
      "Cache-Control": "no-store, private",
    },
  });
}
