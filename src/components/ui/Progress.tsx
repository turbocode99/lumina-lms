import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

/**
 * Progress bar. The track is an inset well and the fill is a gradient that sits
 * proud of it, so the bar reads as liquid filling a carved channel.
 */
export function Progress({
  value,
  className,
  size = "md",
  showLabel = false,
  color,
  label,
}: {
  value: number;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  color?: string;
  label?: string;
}) {
  const percent = clamp(Math.round(value), 0, 100);
  const heights = { xs: "h-1.5", sm: "h-2", md: "h-3", lg: "h-4" };

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--text-secondary)]">
            {label ?? "Progress"}
          </span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
            {percent}%
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className={cn(
          "neu-inset w-full overflow-hidden rounded-full",
          heights[size]
        )}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: color
              ? color
              : "linear-gradient(90deg, var(--accent-soft), var(--accent), var(--secondary))",
            boxShadow: percent > 0
              ? `0 0 12px color-mix(in srgb, ${color ?? "var(--accent)"} 50%, transparent)`
              : undefined,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Circular variant for the dashboard hero and certificate cards, where a ring
 * carries more weight than a bar.
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  children,
  color = "var(--accent)",
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  color?: string;
  className?: string;
}) {
  const percent = clamp(value, 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const gradientId = `ring-${Math.round(percent)}-${size}`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="var(--secondary)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 55%, transparent))`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <span className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {Math.round(percent)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default Progress;
