import { cn } from "@/lib/utils";

type Elevation = "flat" | "sm" | "md" | "lg" | "inset";

const ELEVATIONS: Record<Elevation, string> = {
  flat: "neu-flat",
  sm: "neu-sm",
  md: "neu",
  lg: "neu-lg",
  inset: "neu-inset",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  /** Adds hover lift. Use for cards that are themselves links or buttons. */
  interactive?: boolean;
  padded?: boolean;
}

export function Card({
  className,
  elevation = "md",
  interactive = false,
  padded = true,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-neu)]",
        interactive ? "neu-interactive" : ELEVATIONS[elevation],
        padded && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-5 flex items-start justify-between gap-4", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold tracking-tight text-[var(--text-primary)]",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 text-sm text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-5 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Headline metric tile. The icon sits in an inset well so it reads as carved
 * into the card rather than floating on it.
 */
export function StatCard({
  label,
  value,
  icon,
  trend,
  accent = "var(--accent)",
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive?: boolean };
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "neu rounded-[var(--radius-neu)] p-5 transition-transform duration-300 hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {trend && (
            <p
              className="mt-1.5 text-xs font-medium"
              style={{
                color: trend.positive === false ? "var(--danger)" : "var(--success)",
              }}
            >
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="neu-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default Card;
