import Link from "next/link";
import { BookOpen, Clock, PlayCircle, ShieldAlert, Users } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Rating } from "@/components/ui/Rating";
import { cn, formatDuration, pluralize } from "@/lib/utils";

export interface CourseCardData {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  level: string;
  durationMinutes: number;
  lessonCount: number;
  ratingAvg: number;
  ratingCount: number;
  enrollmentCount: number;
  isMandatory: boolean;
  instructor: { name: string };
  category: { name: string; color: string } | null;
}

/**
 * The catalog tile. When `progress` is supplied it switches into "continue"
 * mode — progress bar instead of enrollment stats — so the same component backs
 * both the catalog and My Learning.
 */
export function CourseCard({
  course,
  progress,
  href,
  className,
}: {
  course: CourseCardData;
  progress?: number | null;
  href?: string;
  className?: string;
}) {
  const target = href ?? `/courses/${course.slug}`;
  const enrolled = typeof progress === "number";
  const accent = course.category?.color ?? "var(--accent)";

  return (
    <Link
      href={target}
      className={cn(
        "neu-interactive group flex flex-col overflow-hidden rounded-[var(--radius-neu)] p-3",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-2xl">
        {course.thumbnailUrl ? (
          // Thumbnails are user-uploaded storage keys or arbitrary internal
          // URLs, so next/image's optimiser adds latency without benefit.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={course.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 45%, var(--secondary)))`,
            }}
          >
            <BookOpen className="h-10 w-10 text-white/70" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/25 backdrop-blur-md">
            <PlayCircle className="h-7 w-7 text-white" />
          </span>
        </span>

        {course.isMandatory && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-[var(--danger)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            <ShieldAlert className="h-3 w-3" />
            Required
          </span>
        )}

        <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Clock className="h-3 w-3" />
          {formatDuration(course.durationMinutes * 60)}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-1.5 pb-1.5">
        {course.category && (
          <span
            className="mb-2 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              color: course.category.color,
              background: `color-mix(in srgb, ${course.category.color} 14%, transparent)`,
            }}
          >
            {course.category.name}
          </span>
        )}

        <h3 className="line-clamp-2 font-semibold leading-snug tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
          {course.title}
        </h3>

        {course.subtitle && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
            {course.subtitle}
          </p>
        )}

        <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">
          {course.instructor.name}
        </p>

        <div className="mt-auto pt-3">
          {enrolled ? (
            <Progress
              value={progress ?? 0}
              size="sm"
              showLabel
              label={progress === 100 ? "Completed" : "In progress"}
            />
          ) : (
            <>
              {course.ratingCount > 0 && (
                <Rating
                  value={course.ratingAvg}
                  count={course.ratingCount}
                  size="sm"
                  className="mb-2"
                />
              )}
              <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {pluralize(course.lessonCount, "lesson")}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {course.enrollmentCount.toLocaleString()}
                </span>
                <Badge tone="outline" className="ml-auto !px-2 !py-0.5 !text-[10px]">
                  {course.level}
                </Badge>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export default CourseCard;
