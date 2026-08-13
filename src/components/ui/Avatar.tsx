import { cn, colorFromString, initials } from "@/lib/utils";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
  "2xl": "h-28 w-28 text-3xl",
};

export function Avatar({
  name,
  src,
  size = "md",
  className,
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  const shared = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
    SIZES[size],
    ring && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]",
    className
  );

  if (src) {
    // Avatars are arbitrary user-supplied URLs or local storage keys, so
    // next/image's optimiser adds no value here.
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={name}
        className={cn(shared, "neu-sm object-cover")}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={cn(shared, "neu-sm text-white")}
      style={{ background: colorFromString(name) }}
      aria-label={name}
      title={name}
    >
      {initials(name) || "?"}
    </span>
  );
}

/** Overlapping stack for "12 colleagues are taking this course". */
export function AvatarGroup({
  people,
  max = 4,
  size = "sm",
}: {
  people: { name: string; avatarUrl?: string | null }[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((person, i) => (
        <div
          key={`${person.name}-${i}`}
          className="-ml-2 first:ml-0 rounded-full ring-2 ring-[var(--surface)]"
        >
          <Avatar name={person.name} src={person.avatarUrl} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "neu-sm -ml-2 inline-flex items-center justify-center rounded-full font-semibold text-[var(--text-secondary)] ring-2 ring-[var(--surface)]",
            SIZES[size]
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export default Avatar;
