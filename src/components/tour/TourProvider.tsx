"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import { markTourSeenAction } from "@/app/actions/tour";
import { tourForRoute, type Tour } from "@/lib/tours";
import type { Role } from "@/lib/enums";

import { GuidedTour } from "./GuidedTour";

/**
 * Decides which tour applies to the current screen and whether to start it.
 *
 * Completion state is fetched once with the layout and held here, then updated
 * locally on close — so navigating between screens never waits on a round trip to
 * work out whether a tour has been seen, and a finished tour cannot flash on the
 * next page load.
 */

interface TourContextValue {
  /** The tour for the current route, if the user's role qualifies. */
  available: Tour | null;
  /** Whether the current route's tour has already been seen. */
  seen: boolean;
  /** Start (or restart) the current route's tour. */
  start: () => void;
}

const TourContext = createContext<TourContextValue>({
  available: null,
  seen: true,
  start: () => {},
});

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({
  role,
  seenTourIds,
  autoStart,
  children,
}: {
  role: Role;
  seenTourIds: string[];
  /** False disables first-visit auto-start, leaving tours launch-only. */
  autoStart: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [seen, setSeen] = useState<Set<string>>(() => new Set(seenTourIds));
  const [activeTour, setActiveTour] = useState<Tour | null>(null);

  const available = useMemo(
    () => (pathname ? tourForRoute(pathname, role) : null),
    [pathname, role]
  );

  const alreadySeen = available ? seen.has(available.id) : true;

  /**
   * Auto-start on first visit, after a short delay so the page has painted and
   * the anchors exist — measuring immediately gives a spotlight on the wrong box.
   */
  useEffect(() => {
    if (!autoStart || !available || seen.has(available.id)) return;

    const timer = window.setTimeout(() => {
      // Re-check: the user may have navigated away during the delay.
      if (document.querySelector("[data-tour]")) setActiveTour(available);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [autoStart, available, seen]);

  // Close any running tour when the route changes.
  useEffect(() => {
    setActiveTour(null);
  }, [pathname]);

  const close = useCallback(
    (outcome: "finished" | "dismissed") => {
      const tour = activeTour;
      setActiveTour(null);
      if (!tour) return;

      // Optimistic: the tour should not reappear even if the write is slow.
      setSeen((current) => new Set(current).add(tour.id));
      void markTourSeenAction(tour.id, outcome);
    },
    [activeTour]
  );

  const start = useCallback(() => {
    if (available) setActiveTour(available);
  }, [available]);

  const value = useMemo(
    () => ({ available, seen: alreadySeen, start }),
    [available, alreadySeen, start]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && <GuidedTour tour={activeTour} onClose={close} />}
    </TourContext.Provider>
  );
}

export default TourProvider;
