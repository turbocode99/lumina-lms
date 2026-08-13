"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  HelpCircle,
  Lock,
  Paperclip,
  PlayCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { cn, formatDuration, pluralize } from "@/lib/utils";
import type { LessonType } from "@/lib/enums";

export interface CurriculumLesson {
  id: string;
  title: string;
  type: string;
  durationSeconds: number;
  isPreview: boolean;
  completed?: boolean;
}

export interface CurriculumSection {
  id: string;
  title: string;
  lessons: CurriculumLesson[];
}

const ICONS: Record<LessonType, React.ReactNode> = {
  VIDEO: <PlayCircle className="h-4 w-4" />,
  ARTICLE: <FileText className="h-4 w-4" />,
  QUIZ: <HelpCircle className="h-4 w-4" />,
  RESOURCE: <Paperclip className="h-4 w-4" />,
};

/**
 * Curriculum accordion. Used on the course detail page (where locked lessons
 * are inert) and as the player sidebar (where every lesson links).
 */
export function Curriculum({
  sections,
  courseSlug,
  hasAccess,
  currentLessonId,
  defaultOpenAll = false,
  compact = false,
}: {
  sections: CurriculumSection[];
  courseSlug: string;
  hasAccess: boolean;
  currentLessonId?: string;
  defaultOpenAll?: boolean;
  compact?: boolean;
}) {
  // The section holding the current lesson starts open; otherwise just the first.
  const initiallyOpen = new Set(
    defaultOpenAll
      ? sections.map((s) => s.id)
      : currentLessonId
        ? sections
            .filter((s) => s.lessons.some((l) => l.id === currentLessonId))
            .map((s) => s.id)
        : sections.slice(0, 1).map((s) => s.id)
  );

  const [open, setOpen] = useState<Set<string>>(initiallyOpen);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {sections.map((section, sectionIndex) => {
        const isOpen = open.has(section.id);
        const seconds = section.lessons.reduce(
          (acc, l) => acc + l.durationSeconds,
          0
        );
        const done = section.lessons.filter((l) => l.completed).length;

        return (
          <div
            key={section.id}
            className={cn(
              "overflow-hidden rounded-2xl",
              compact ? "neu-sm" : "neu"
            )}
          >
            <button
              type="button"
              onClick={() => toggle(section.id)}
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-center gap-3 text-left transition-colors hover:bg-[var(--surface-raised)]",
                compact ? "p-3.5" : "p-4 sm:p-5"
              )}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-250",
                  isOpen && "rotate-180"
                )}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-semibold text-[var(--text-primary)]",
                    compact ? "text-sm" : "text-[15px]"
                  )}
                >
                  <span className="text-[var(--text-muted)]">
                    {sectionIndex + 1}.
                  </span>{" "}
                  {section.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {pluralize(section.lessons.length, "lesson")}
                  {seconds > 0 && ` · ${formatDuration(seconds)}`}
                  {hasAccess && section.lessons.length > 0 && (
                    <> · {done}/{section.lessons.length} done</>
                  )}
                </p>
              </div>

              {hasAccess && done === section.lessons.length && done > 0 && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" />
              )}
            </button>

            {isOpen && (
              <ul className="border-t border-[var(--border-subtle)]">
                {section.lessons.map((lesson) => {
                  const unlocked = hasAccess || lesson.isPreview;
                  const active = lesson.id === currentLessonId;
                  const icon = ICONS[lesson.type as LessonType] ?? ICONS.VIDEO;

                  const inner = (
                    <>
                      <span className="shrink-0">
                        {!unlocked ? (
                          <Lock className="h-4 w-4 text-[var(--text-muted)]" />
                        ) : lesson.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                        ) : active ? (
                          <PlayCircle className="h-4 w-4 text-[var(--accent)]" />
                        ) : (
                          <Circle className="h-4 w-4 text-[var(--text-muted)] opacity-50" />
                        )}
                      </span>

                      <span
                        className={cn(
                          "shrink-0",
                          active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                        )}
                      >
                        {icon}
                      </span>

                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          active
                            ? "font-semibold text-[var(--accent)]"
                            : lesson.completed
                              ? "text-[var(--text-muted)]"
                              : "text-[var(--text-secondary)]"
                        )}
                      >
                        {lesson.title}
                      </span>

                      {lesson.isPreview && !hasAccess && (
                        <Badge tone="accent" className="!px-2 !py-0.5 !text-[10px]">
                          Preview
                        </Badge>
                      )}

                      {lesson.durationSeconds > 0 && (
                        <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                          {formatDuration(lesson.durationSeconds)}
                        </span>
                      )}
                    </>
                  );

                  const className = cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors sm:px-5",
                    active && "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
                    unlocked
                      ? "hover:bg-[var(--surface-raised)]"
                      : "cursor-not-allowed opacity-60"
                  );

                  return (
                    <li
                      key={lesson.id}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      {unlocked ? (
                        <Link
                          href={`/learn/${courseSlug}/${lesson.id}`}
                          className={className}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className={className} aria-disabled>
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Curriculum;
