"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

const SIZES = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6", xl: "h-8 w-8" };

/** Read-only star display with partial fill for averages like 4.6. */
export function Rating({
  value,
  count,
  size = "md",
  showValue = true,
  className,
}: {
  value: number;
  count?: number;
  size?: keyof typeof SIZES;
  showValue?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {showValue && (
        <span className="text-sm font-semibold tabular-nums text-[var(--warning)]">
          {value.toFixed(1)}
        </span>
      )}
      <div className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(1, value - star + 1));
          return (
            <span key={star} className="relative inline-block">
              <Star
                className={cn(SIZES[size], "text-[var(--text-muted)] opacity-40")}
              />
              {fill > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star
                    className={cn(
                      SIZES[size],
                      "fill-[var(--warning)] text-[var(--warning)]"
                    )}
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-[var(--text-muted)]">
          ({count.toLocaleString()})
        </span>
      )}
    </div>
  );
}

/** Interactive picker for the review form. Writes to a hidden input. */
export function RatingInput({
  name = "rating",
  defaultValue = 0,
  size = "xl",
  onChange,
}: {
  name?: string;
  defaultValue?: number;
  size?: keyof typeof SIZES;
  onChange?: (value: number) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const pick = (star: number) => {
    setValue(star);
    onChange?.(star);
  };

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="Rating"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(star)}
            onClick={() => pick(star)}
            className="rounded-lg p-0.5 transition-transform duration-150 hover:scale-110"
          >
            <Star
              className={cn(
                SIZES[size],
                "transition-colors duration-150",
                star <= shown
                  ? "fill-[var(--warning)] text-[var(--warning)]"
                  : "text-[var(--text-muted)] opacity-40"
              )}
            />
          </button>
        ))}
      </div>
      {shown > 0 && (
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          {["Poor", "Fair", "Good", "Great", "Excellent"][shown - 1]}
        </span>
      )}
    </div>
  );
}

export default Rating;
