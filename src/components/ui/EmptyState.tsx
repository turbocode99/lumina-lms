import { cn } from "@/lib/utils";
import { ButtonLink } from "./Button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-neu)] px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="neu-inset mb-5 flex h-20 w-20 items-center justify-center rounded-full text-[var(--text-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {action && (
        <ButtonLink href={action.href} variant="primary" className="mt-6">
          {action.label}
        </ButtonLink>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="neu rounded-[var(--radius-neu)] p-4">
      <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-4 h-3 w-1/2" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export default EmptyState;
