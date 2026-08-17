"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { assertUser } from "@/lib/rbac";
import { TOURS } from "@/lib/tours";

/**
 * Tour progress is recorded server-side so it follows the account rather than the
 * browser. Finishing and skipping are stored distinctly — both stop the tour
 * auto-starting, but the difference is worth keeping for anyone measuring whether
 * the tours are useful.
 */

const VALID_TOUR_IDS = new Set(TOURS.map((tour) => tour.id));

export async function markTourSeenAction(
  tourId: string,
  outcome: "finished" | "dismissed"
): Promise<{ ok: boolean }> {
  const user = await assertUser();

  // Ids come from the client, so check against the known set rather than writing
  // arbitrary strings.
  if (!VALID_TOUR_IDS.has(tourId)) return { ok: false };

  const now = new Date();
  const data =
    outcome === "finished" ? { finishedAt: now } : { dismissedAt: now };

  await db.tourCompletion.upsert({
    where: { userId_tourId: { userId: user.id, tourId } },
    create: { userId: user.id, tourId, ...data },
    update: data,
  });

  return { ok: true };
}

/** Clears all tour history for the current user so they replay from the start. */
export async function resetToursAction(): Promise<void> {
  const user = await assertUser();
  await db.tourCompletion.deleteMany({ where: { userId: user.id } });
  revalidatePath("/", "layout");
}

/** Clears one tour, used by the "replay" buttons in the profile list. */
export async function replayTourAction(formData: FormData): Promise<void> {
  const user = await assertUser();
  const tourId = String(formData.get("tourId") || "");
  if (!VALID_TOUR_IDS.has(tourId)) return;

  await db.tourCompletion.deleteMany({ where: { userId: user.id, tourId } });
  revalidatePath("/", "layout");
}
