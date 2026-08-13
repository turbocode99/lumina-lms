import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";

const TONES: Record<Tone, string> = {
  neutral: "neu-sm text-[var(--text-secondary)]",
  accent:
    "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]",
  success:
    "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]",
  warning:
    "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
  danger:
    "bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)]",
  info: "bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-[var(--info)]",
  outline:
    "border border-[var(--border-subtle)] text-[var(--text-muted)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: React.ReactNode;
}

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-tight",
        TONES[tone],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/** Maps course status to a consistent tone across catalog, builder, and admin. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    PUBLISHED: { tone: "success", label: "Published" },
    DRAFT: { tone: "warning", label: "Draft" },
    ARCHIVED: { tone: "neutral", label: "Archived" },
  };
  const config = map[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, Tone> = {
    ADMIN: "danger",
    INSTRUCTOR: "info",
    LEARNER: "neutral",
  };
  const label = role.charAt(0) + role.slice(1).toLowerCase();
  return <Badge tone={map[role] ?? "neutral"}>{label}</Badge>;
}

export default Badge;
