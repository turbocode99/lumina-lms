import { Download } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { ReportName } from "@/lib/reports";

/**
 * Downloads a compliance report.
 *
 * A real form navigation rather than a <Link>: the target is a route handler
 * that answers with `Content-Disposition: attachment`, and client-side routing
 * would try to render the CSV as a page instead of saving it.
 */
export function ExportButton({
  report,
  status,
  label = "Export CSV",
}: {
  report: ReportName;
  /** Passed through so the file matches the filter the admin is looking at. */
  status?: string | null;
  label?: string;
}) {
  return (
    <form action={`/api/admin/export/${report}`} method="get">
      {status && <input type="hidden" name="status" value={status} />}
      <Button type="submit" variant="secondary">
        <Download className="h-4 w-4" />
        {label}
      </Button>
    </form>
  );
}

export default ExportButton;
