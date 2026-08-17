import Link from "next/link";
import { Check, Compass, RotateCcw } from "lucide-react";

import { replayTourAction, resetToursAction } from "@/app/actions/tour";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { toursForRole } from "@/lib/tours";

/**
 * Profile panel listing every tour the user's role can see, with per-tour replay
 * and a reset-all.
 *
 * Worth having because a tour is otherwise a one-shot: dismiss it on your first
 * day and the explanation is gone for good. Each row links to the screen it
 * belongs to, so replaying means arriving where the tour actually runs.
 */
export async function TourSettings({ user }: { user: SessionUser }) {
  const tours = toursForRole(user.role);

  const completions = await db.tourCompletion.findMany({
    where: { userId: user.id },
    select: { tourId: true, finishedAt: true, dismissedAt: true },
  });

  const byId = new Map(completions.map((c) => [c.tourId, c]));
  const seenCount = tours.filter((tour) => byId.has(tour.id)).length;

  return (
    <Card>
      <CardTitle className="mb-2 flex items-center gap-2">
        <Compass className="h-5 w-5 text-[var(--accent)]" />
        Guided tours
      </CardTitle>
      <p className="mb-5 text-sm text-[var(--text-muted)]">
        Each screen has a short walkthrough that runs once on your first visit. You
        can replay any of them — {seenCount} of {tours.length} seen so far.
      </p>

      <ul className="space-y-2">
        {tours.map((tour) => {
          const record = byId.get(tour.id);
          const finished = Boolean(record?.finishedAt);
          const skipped = Boolean(record?.dismissedAt) && !finished;

          return (
            <li
              key={tour.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-raised)]"
            >
              <Link
                href={tour.route}
                className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
              >
                {tour.name}
              </Link>

              {finished ? (
                <Badge tone="success" icon={<Check className="h-3 w-3" />}>
                  Done
                </Badge>
              ) : skipped ? (
                <Badge tone="neutral">Skipped</Badge>
              ) : (
                <Badge tone="accent">Not seen</Badge>
              )}

              {record && (
                <form action={replayTourAction}>
                  <input type="hidden" name="tourId" value={tour.id} />
                  <Button type="submit" size="sm">
                    Replay
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {seenCount > 0 && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
          <form action={resetToursAction}>
            <Button type="submit">
              <RotateCcw className="h-4 w-4" />
              Reset all tours
            </Button>
          </form>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Every tour will run again on your next visit to its screen.
          </p>
        </div>
      )}
    </Card>
  );
}

export default TourSettings;
