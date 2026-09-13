import "server-only";

import { db } from "@/lib/db";

/**
 * Leaderboard.
 *
 * Two decisions shape this, and both are about what a leaderboard does to
 * people rather than what it does to data.
 *
 * It shows a top slice, never a full ranking. A complete ordering of everyone
 * is also, read from the bottom, a published list of who has done least — which
 * inside a company is a different and much less pleasant artefact than a
 * scoreboard. Admins who need the whole picture have the CSV exports, where it
 * belongs.
 *
 * A viewer sees their own standing, and only their own, and only once they have
 * something on the board. Telling someone they are last is not motivating, and
 * it is the one thing this surface could do that nobody asked for.
 */

export const PERIODS = ["month", "quarter", "all"] as const;
export type LeaderboardPeriod = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  month: "Last 30 days",
  quarter: "Last 90 days",
  all: "All time",
};

export function isPeriod(value: string | undefined): value is LeaderboardPeriod {
  return (PERIODS as readonly string[]).includes(value ?? "");
}

/** How far the public board goes. See the note at the top of this file. */
export const LEADERBOARD_LIMIT = 10;

/**
 * A rolling window rather than a calendar one. Calendar months make the board
 * near-empty every first of the month and unbeatable by the 28th; a rolling
 * window always covers a full period of work.
 */
function since(period: LeaderboardPeriod): Date | null {
  if (period === "all") return null;
  const days = period === "month" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000);
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  department: string | null;
  avatarUrl: string | null;
  coursesCompleted: number;
  lessonsCompleted: number;
  /** Competition ranking: ties share a rank and the next one skips. */
  rank: number;
}

export interface LeaderboardResult {
  top: LeaderboardEntry[];
  /** The viewer's own row, present only when they are on the board at all. */
  viewer: (LeaderboardEntry & { total: number }) | null;
  /** How many people have any activity in the period. */
  total: number;
}

export async function getLeaderboard(
  period: LeaderboardPeriod,
  viewerId: string,
  limit = LEADERBOARD_LIMIT
): Promise<LeaderboardResult> {
  const from = since(period);

  const [courseGroups, lessonGroups] = await Promise.all([
    db.enrollment.groupBy({
      by: ["userId"],
      where: from
        ? { completedAt: { not: null, gte: from } }
        : { completedAt: { not: null } },
      _count: { _all: true },
    }),
    db.lessonProgress.groupBy({
      by: ["userId"],
      where: from
        ? { completed: true, completedAt: { not: null, gte: from } }
        : { completed: true, completedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const courses = new Map(courseGroups.map((g) => [g.userId, g._count._all]));
  const lessons = new Map(lessonGroups.map((g) => [g.userId, g._count._all]));
  const ids = [...new Set([...courses.keys(), ...lessons.keys()])];
  if (!ids.length) return { top: [], viewer: null, total: 0 };

  // Filtering on isActive here rather than in the groupBy keeps leavers off the
  // board without a relation filter, and drops any id whose user row is gone.
  const users = await db.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, name: true, department: true, avatarUrl: true },
  });

  const ranked = users
    .map((user) => ({
      userId: user.id,
      name: user.name,
      department: user.department,
      avatarUrl: user.avatarUrl,
      coursesCompleted: courses.get(user.id) ?? 0,
      lessonsCompleted: lessons.get(user.id) ?? 0,
      rank: 0,
    }))
    .sort(
      (a, b) =>
        b.coursesCompleted - a.coursesCompleted ||
        b.lessonsCompleted - a.lessonsCompleted ||
        a.name.localeCompare(b.name)
    );

  let lastRank = 0;
  ranked.forEach((entry, index) => {
    const previous = ranked[index - 1];
    const tied =
      previous &&
      previous.coursesCompleted === entry.coursesCompleted &&
      previous.lessonsCompleted === entry.lessonsCompleted;
    lastRank = tied ? lastRank : index + 1;
    entry.rank = lastRank;
  });

  const viewerEntry = ranked.find((entry) => entry.userId === viewerId) ?? null;

  return {
    top: ranked.slice(0, limit),
    viewer: viewerEntry ? { ...viewerEntry, total: ranked.length } : null,
    total: ranked.length,
  };
}
