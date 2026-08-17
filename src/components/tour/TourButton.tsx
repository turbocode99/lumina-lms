"use client";

import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { useTour } from "./TourProvider";

/**
 * Topbar launcher. Renders nothing on screens without a tour, so it never
 * promises help that does not exist.
 *
 * Before the tour has been seen it carries a pulse ring — the one nudge the
 * feature gets. Afterwards it goes quiet and simply stays available for a replay.
 */
export function TourButton() {
  const { available, seen, start } = useTour();

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={start}
      aria-label={seen ? `Replay tour: ${available.name}` : `Take the tour: ${available.name}`}
      title={seen ? `Replay: ${available.name}` : `Tour this page: ${available.name}`}
      className={cn(
        "neu-interactive relative flex h-10 w-10 items-center justify-center rounded-xl",
        seen ? "text-[var(--text-secondary)]" : "text-[var(--accent)]"
      )}
    >
      <HelpCircle className="h-[18px] w-[18px]" />
      {!seen && (
        <span
          className="absolute inset-0 rounded-xl animate-pulse-ring"
          aria-hidden
        />
      )}
    </button>
  );
}

export default TourButton;
