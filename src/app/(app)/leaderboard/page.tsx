import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/rbac";
import {
  LEADERBOARD_LIMIT,
  PERIODS,
  PERIOD_LABELS,
  getLeaderboard,
  isPeriod,
  type LeaderboardPeriod,
} from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

/** Gold, silver, bronze for the top three; everyone else gets the plain well. */
const MEDALS: Record<number, string> = {
  1: "var(--warning)",
  2: "var(--text-muted)",
  3: "#b06c3f",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  if (!luminaConfig.features.leaderboard) notFound();
  const user = await requireUser("/leaderboard");

  const { period: raw } = await searchParams;
  const period: LeaderboardPeriod = isPeriod(raw) ? raw : "month";

  const { top, viewer, total } = await getLeaderboard(period, user.id);

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Leaderboard
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Who has been finishing the most across{" "}
          {luminaConfig.brand.organization}.
        </p>
      </header>

      {/* Links rather than a client tab bar, so a period is a shareable URL —
          the same rule the catalog filters follow. */}
      <div
        data-tour="leaderboard-period"
        className="neu-inset inline-flex gap-1 rounded-2xl p-1"
      >
        {PERIODS.map((option) => (
          <Link
            key={option}
            href={`/leaderboard?period=${option}`}
            aria-current={option === period ? "page" : undefined}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              option === period
                ? "neu text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {PERIOD_LABELS[option]}
          </Link>
        ))}
      </div>

      {viewer && (
        <Card data-tour="leaderboard-you" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-[var(--accent)]">
                #{viewer.rank}
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  Your standing
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {viewer.rank} of {viewer.total} with activity in this period.
                  Only you see this.
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <Stat label="Courses" value={viewer.coursesCompleted} />
              <Stat label="Lessons" value={viewer.lessonsCompleted} />
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 pt-5">
          <CardTitle>Top learners</CardTitle>
          {total > 0 && (
            <span className="text-sm text-[var(--text-muted)]">
              {total} active
            </span>
          )}
        </div>

        {top.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            title="Nothing on the board yet"
            description="Finish a lesson and this fills up. Rankings cover the period selected above."
            action={{ label: "Browse catalog", href: "/catalog" }}
          />
        ) : (
          <ul data-tour="leaderboard-list" className="mt-4 divide-y divide-[var(--border)]">
            {top.map((entry) => (
              <li
                key={entry.userId}
                className={cn(
                  "flex items-center gap-4 px-5 py-4",
                  entry.userId === user.id &&
                    "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]"
                )}
              >
                <span
                  className="w-8 shrink-0 text-center text-lg font-bold tabular-nums"
                  style={{ color: MEDALS[entry.rank] ?? "var(--text-muted)" }}
                >
                  {entry.rank}
                </span>

                <Avatar name={entry.name} src={entry.avatarUrl} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--text-primary)]">
                    {entry.name}
                    {entry.userId === user.id && (
                      <span className="ml-2 text-xs font-semibold text-[var(--accent)]">
                        You
                      </span>
                    )}
                  </p>
                  {entry.department && (
                    <p className="truncate text-sm text-[var(--text-muted)]">
                      {entry.department}
                    </p>
                  )}
                </div>

                <div className="flex gap-6">
                  <Stat label="Courses" value={entry.coursesCompleted} />
                  <Stat label="Lessons" value={entry.lessonsCompleted} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="px-1 text-sm text-[var(--text-muted)]">
        {total > top.length &&
          `Showing the top ${top.length} of ${total} people with activity. `}
        The board stops at {LEADERBOARD_LIMIT} by design — read from the bottom,
        a full ordering is a list of who has done least, which is not what this
        is for.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}
