"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Placement, Tour, TourStep } from "@/lib/tours";

/**
 * Guided tour overlay.
 *
 * Written in-house rather than pulling in a tour library: the whole thing is a
 * spotlight, a positioned card, and keyboard handling, and a dependency would
 * bring its own theming to fight with the neumorphic tokens.
 *
 * The spotlight is one absolutely-positioned element carrying a very large
 * `box-shadow` spread, which dims everything outside its own box. That avoids the
 * usual four-panels-around-the-hole approach and gives a rounded cutout for free.
 */

const PADDING = 8;
const CARD_WIDTH = 340;
const GAP = 14;
const EDGE = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function rectOf(element: Element): Rect {
  const r = element.getBoundingClientRect();
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
}

/** Card position, flipped or clamped so it always stays on screen. */
function placeCard(
  rect: Rect | null,
  placement: Placement,
  viewport: { width: number; height: number },
  cardHeight: number
): { top: number; left: number; placement: Placement } {
  if (!rect || placement === "center") {
    return {
      top: Math.max(EDGE, viewport.height / 2 - cardHeight / 2),
      left: Math.max(EDGE, viewport.width / 2 - CARD_WIDTH / 2),
      placement: "center",
    };
  }

  const fits = {
    bottom: rect.top + rect.height + GAP + cardHeight <= viewport.height - EDGE,
    top: rect.top - GAP - cardHeight >= EDGE,
    right: rect.left + rect.width + GAP + CARD_WIDTH <= viewport.width - EDGE,
    left: rect.left - GAP - CARD_WIDTH >= EDGE,
  };

  // Try the requested side, then the opposite, then anything that fits.
  const opposite: Record<Exclude<Placement, "center">, Placement> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const order: Placement[] = [
    placement,
    opposite[placement as Exclude<Placement, "center">],
    "bottom",
    "top",
    "right",
    "left",
  ];
  const chosen =
    order.find((candidate) => candidate !== "center" && fits[candidate as keyof typeof fits]) ??
    "center";

  if (chosen === "center") {
    return {
      top: Math.max(EDGE, viewport.height / 2 - cardHeight / 2),
      left: Math.max(EDGE, viewport.width / 2 - CARD_WIDTH / 2),
      placement: "center",
    };
  }

  let top: number;
  let left: number;

  if (chosen === "bottom" || chosen === "top") {
    top = chosen === "bottom" ? rect.top + rect.height + GAP : rect.top - GAP - cardHeight;
    left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  } else {
    left = chosen === "right" ? rect.left + rect.width + GAP : rect.left - GAP - CARD_WIDTH;
    top = rect.top + rect.height / 2 - cardHeight / 2;
  }

  return {
    top: Math.min(Math.max(EDGE, top), viewport.height - cardHeight - EDGE),
    left: Math.min(Math.max(EDGE, left), viewport.width - CARD_WIDTH - EDGE),
    placement: chosen,
  };
}

export function GuidedTour({
  tour,
  onClose,
}: {
  tour: Tour;
  /** `finished` when the last step was reached, `dismissed` when skipped. */
  onClose: (outcome: "finished" | "dismissed") => void;
}) {
  // Steps whose anchor is not on the page are dropped up front, so a missing
  // element never becomes an empty spotlight mid-tour.
  const steps = useMemo(
    () => tour.steps.filter((step) => !step.target || findTarget(step)),
    [tour]
  );

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(200);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });
  const [mounted, setMounted] = useState(false);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  useEffect(() => setMounted(true), []);

  /**
   * Bring the anchor into view and measure it immediately.
   *
   * The measurement deliberately does not wait for the animation-frame loop below.
   * `requestAnimationFrame` is tied to the compositor and does not run at all in a
   * hidden or occluded tab, so a loop-only design leaves `rect` null and the
   * spotlight never renders. Measuring here means the first paint is correct
   * regardless, and the loop only has to keep it correct.
   */
  useLayoutEffect(() => {
    if (!step) return;

    const element = findTarget(step);
    if (!element) {
      setRect(null);
      return;
    }

    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
      inline: "nearest",
    });

    setViewport({ width: window.innerWidth, height: window.innerHeight });
    setRect(rectOf(element));
  }, [step]);

  /**
   * Re-measure every frame while the tour is open.
   *
   * This replaced scroll and resize listeners. Those only fire for the specific
   * events they name, so anything else that moves the anchor — a lazily loaded
   * image reflowing the page, an accordion expanding, a CSS transition, a
   * programmatic scroll that emits no event — left the spotlight sitting over
   * empty space with nothing to correct it.
   *
   * The cost is one getBoundingClientRect per frame against a single element,
   * which is negligible, and state only updates when the rect actually changes so
   * React re-renders no more than the old listeners caused.
   */
  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const element = step ? findTarget(step) : null;
      const next = element ? rectOf(element) : null;

      setRect((current) => {
        if (!current && !next) return current;
        if (!current || !next) return next;
        const same =
          Math.abs(current.top - next.top) < 0.5 &&
          Math.abs(current.left - next.left) < 0.5 &&
          Math.abs(current.width - next.width) < 0.5 &&
          Math.abs(current.height - next.height) < 0.5;
        return same ? current : next;
      });

      setViewport((current) =>
        current.width === window.innerWidth && current.height === window.innerHeight
          ? current
          : { width: window.innerWidth, height: window.innerHeight }
      );

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const finish = useCallback(() => onClose("finished"), [onClose]);
  const skip = useCallback(() => onClose("dismissed"), [onClose]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }, [isLast, finish]);

  const previous = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          skip();
          break;
        case "ArrowRight":
        case "Enter":
          event.preventDefault();
          next();
          break;
        case "ArrowLeft":
          event.preventDefault();
          previous();
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [next, previous, skip]);

  /**
   * Scrolling is deliberately NOT locked.
   *
   * An earlier version set `body { overflow: hidden }` for the duration of the
   * tour to stop the spotlight drifting from its anchor. That was both unnecessary
   * — the spotlight and card re-measure on scroll, so they track the anchor
   * correctly — and actively harmful: the lock was applied from an effect that
   * runs before the render, so when every step filtered out and the component
   * returned null, the page was left unscrollable with no visible overlay to
   * dismiss. That is exactly what "scrolling is stuck on the course creation
   * screen" was.
   *
   * Not locking removes the failure mode entirely rather than guarding it, and
   * letting people scroll during a tour is friendlier anyway.
   */

  if (!mounted || !step) return null;

  const position = placeCard(rect, step.placement ?? "bottom", viewport, cardHeight);

  return createPortal(
    <div
      className="fixed inset-0 z-[300]"
      role="dialog"
      aria-modal="true"
      aria-label={`${tour.name}: step ${index + 1} of ${steps.length}`}
    >
      {/* Backdrop for centred steps, where there is nothing to cut out. */}
      {!rect && <div className="absolute inset-0 bg-black/60 animate-fade-in" />}

      {/* Spotlight. The oversized shadow spread dims everything outside it. */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl transition-all duration-300 ease-out"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
            outline: "2px solid var(--accent)",
            outlineOffset: "2px",
          }}
        />
      )}

      {/* Clicking outside the card skips, which is the conventional escape. */}
      <button
        type="button"
        aria-label="Skip tour"
        onClick={skip}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      <div
        ref={(node) => {
          if (node && Math.abs(node.offsetHeight - cardHeight) > 4) {
            setCardHeight(node.offsetHeight);
          }
        }}
        className="neu-lg absolute animate-scale-in rounded-[var(--radius-neu)] p-5"
        style={{
          top: position.top,
          left: position.left,
          width: CARD_WIDTH,
          background: "var(--surface)",
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
            {tour.name} · {index + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={skip}
            aria-label="Skip tour"
            className="-mr-1 -mt-1 rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-base font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {step.body}
        </p>

        <div className="mt-5 flex items-center gap-2">
          {/* Progress dots double as direct navigation. */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-250",
                  i === index
                    ? "w-5 bg-[var(--accent)]"
                    : "w-1.5 bg-[var(--text-muted)] opacity-35 hover:opacity-60"
                )}
              />
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={previous}
                className="neu-interactive flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)]"
                aria-label="Previous step"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={next}
              autoFocus
              className="neu-accent flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
            >
              {isLast ? (
                <>
                  Done
                  <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Arrow keys to move · Esc to close
        </p>
      </div>
    </div>,
    document.body
  );
}

export default GuidedTour;
