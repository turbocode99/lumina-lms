"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  HelpCircle,
  Layers,
  Package,
  Paperclip,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";

import {
  createLessonAction,
  createSectionAction,
  deleteLessonAction,
  deleteSectionAction,
  moveLessonAction,
  moveSectionAction,
  renameSectionAction,
  updateLessonAction,
  type ActionState,
} from "@/app/actions/authoring";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { LESSON_TYPE_LABEL, LESSON_TYPES, type LessonType } from "@/lib/enums";
import { cn, formatDuration } from "@/lib/utils";

import { QuizEditor, type EditableQuestion } from "./QuizEditor";
import { ScormUpload } from "./ScormUpload";
import { UploadField } from "./UploadField";

export interface BuilderLesson {
  id: string;
  title: string;
  type: string;
  summary: string | null;
  contentUrl: string | null;
  contentText: string | null;
  durationSeconds: number;
  isPreview: boolean;
  questions: EditableQuestion[];
  scormPackage: {
    title: string;
    version: string;
    fileCount: number;
    sizeBytes: number;
  } | null;
}

export interface BuilderSection {
  id: string;
  title: string;
  lessons: BuilderLesson[];
}

const TYPE_ICONS: Record<LessonType, React.ReactNode> = {
  VIDEO: <PlayCircle className="h-4 w-4" />,
  ARTICLE: <FileText className="h-4 w-4" />,
  QUIZ: <HelpCircle className="h-4 w-4" />,
  RESOURCE: <Paperclip className="h-4 w-4" />,
  SCORM: <Package className="h-4 w-4" />,
};

const initialState: ActionState = {};

function PendingButton({
  label,
  size = "md",
}: {
  label: string;
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size={size} loading={pending}>
      {label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Lesson form                                                                 */
/* -------------------------------------------------------------------------- */

function LessonForm({
  sectionId,
  lesson,
  onDone,
}: {
  sectionId: string;
  lesson?: BuilderLesson;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    lesson ? updateLessonAction : createLessonAction,
    initialState
  );
  const [type, setType] = useState<string>(lesson?.type ?? "VIDEO");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sectionId" value={sectionId} />
      {lesson && <input type="hidden" name="lessonId" value={lesson.id} />}

      {state.errors?._form && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {state.errors._form}
        </p>
      )}
      {state.ok && <p className="text-sm text-[var(--success)]">{state.message}</p>}

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Input
          name="title"
          label="Lesson title"
          placeholder="Why input validation matters"
          defaultValue={lesson?.title ?? ""}
          error={state.errors?.title}
          required
        />
        <Select
          name="type"
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {LESSON_TYPES.map((option) => (
            <option key={option} value={option}>
              {LESSON_TYPE_LABEL[option]}
            </option>
          ))}
        </Select>
      </div>

      <Input
        name="summary"
        label="Summary (optional)"
        placeholder="One line shown under the lesson title"
        defaultValue={lesson?.summary ?? ""}
        error={state.errors?.summary}
      />

      {type === "VIDEO" && (
        <>
          <UploadField
            name="contentUrl"
            label="Video file"
            kind="video"
            defaultValue={lesson?.contentUrl ?? ""}
            hint="MP4 or WebM. Or paste a URL if the video is hosted elsewhere."
          />
          <Input
            name="durationSeconds"
            type="number"
            min={0}
            label="Duration (seconds)"
            placeholder="600"
            defaultValue={lesson?.durationSeconds || ""}
            hint="Used for the course run time and the curriculum list."
            error={state.errors?.durationSeconds}
          />
        </>
      )}

      {type === "SCORM" && (
        <ScormUpload lessonId={lesson?.id ?? null} current={lesson?.scormPackage ?? null} />
      )}

      {type === "ARTICLE" && (
        <>
          <Textarea
            name="contentText"
            label="Article content"
            placeholder="Write the lesson. Line breaks are preserved."
            rows={12}
            defaultValue={lesson?.contentText ?? ""}
            error={state.errors?.contentText}
          />
          <Input
            name="durationSeconds"
            type="number"
            min={0}
            label="Estimated reading time (seconds)"
            placeholder="300"
            defaultValue={lesson?.durationSeconds || ""}
            error={state.errors?.durationSeconds}
          />
        </>
      )}

      {type === "RESOURCE" && (
        <UploadField
          name="contentUrl"
          label="Resource file"
          kind="resource"
          defaultValue={lesson?.contentUrl ?? ""}
          hint="PDF, ZIP, or image. Learners get a download button."
        />
      )}

      {type === "QUIZ" && (
        <p className="rounded-2xl bg-[var(--surface-sunken)] p-4 text-sm text-[var(--text-muted)]">
          Save the lesson first, then add questions from the lesson list below.
        </p>
      )}

      {/* Hidden fields keep unrelated columns from being wiped when the type
          changes — the schema expects every key on every submit. */}
      {type !== "VIDEO" && type !== "RESOURCE" && (
        <input type="hidden" name="contentUrl" value="" />
      )}
      {type !== "ARTICLE" && <input type="hidden" name="contentText" value="" />}
      {type === "QUIZ" && (
        <input type="hidden" name="durationSeconds" value={lesson?.durationSeconds ?? 0} />
      )}
      {type === "RESOURCE" && (
        <input type="hidden" name="durationSeconds" value={lesson?.durationSeconds ?? 0} />
      )}

      <Checkbox
        name="isPreview"
        defaultChecked={lesson?.isPreview ?? false}
        label="Free preview"
        description="Viewable on the course page before enrolling."
      />

      <div className="flex gap-3">
        <PendingButton label={lesson ? "Save lesson" : "Add lesson"} size="sm" />
        <Button type="button" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Section form                                                                */
/* -------------------------------------------------------------------------- */

function AddSectionForm({
  courseId,
  onDone,
}: {
  courseId: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(createSectionAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <Input
        name="title"
        label="Section title"
        placeholder="Getting started"
        containerClassName="min-w-[240px] flex-1"
        error={state.errors?.title ?? state.errors?._form}
        required
        autoFocus
      />
      <PendingButton label="Add section" size="sm" />
      <Button type="button" size="sm" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Builder                                                                     */
/* -------------------------------------------------------------------------- */

export function CurriculumBuilder({
  courseId,
  sections,
}: {
  courseId: string;
  sections: BuilderSection[];
}) {
  const [addingSection, setAddingSection] = useState(false);
  const [addingLessonTo, setAddingLessonTo] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [renamingSection, setRenamingSection] = useState<string | null>(null);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            <Layers className="h-5 w-5 text-[var(--accent)]" />
            Curriculum
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {sections.length} section{sections.length === 1 ? "" : "s"} ·{" "}
            {totalLessons} lesson{totalLessons === 1 ? "" : "s"}
          </p>
        </div>

        {!addingSection && (
          <Button onClick={() => setAddingSection(true)} variant="primary">
            <Plus className="h-4 w-4" />
            Add section
          </Button>
        )}
      </div>

      {addingSection && (
        <div className="neu-inset rounded-2xl p-5">
          <AddSectionForm
            courseId={courseId}
            onDone={() => setAddingSection(false)}
          />
        </div>
      )}

      {sections.length === 0 && !addingSection ? (
        <div className="neu rounded-[var(--radius-neu)]">
          <EmptyState
            icon={<Layers className="h-9 w-9" />}
            title="No sections yet"
            description="Courses are organised into sections, each holding a handful of lessons. Add your first section to get started."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, sectionIndex) => {
            const isCollapsed = collapsed.has(section.id);
            const seconds = section.lessons.reduce(
              (acc, l) => acc + l.durationSeconds,
              0
            );

            return (
              <div
                key={section.id}
                className="neu overflow-hidden rounded-[var(--radius-neu)]"
              >
                {/* Section header */}
                <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(section.id)}
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                    className="neu-interactive flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)]"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-250",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                  </button>

                  {renamingSection === section.id ? (
                    <form
                      action={renameSectionAction}
                      className="flex min-w-[220px] flex-1 items-center gap-2"
                      onSubmit={() => setRenamingSection(null)}
                    >
                      <input type="hidden" name="sectionId" value={section.id} />
                      <div className="neu-inset neu-input flex-1 rounded-xl px-3.5 py-2">
                        <input
                          name="title"
                          defaultValue={section.title}
                          autoFocus
                          className="w-full bg-transparent text-sm font-semibold outline-none"
                        />
                      </div>
                      <Button type="submit" size="sm" variant="primary">
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setRenamingSection(null)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[var(--text-primary)]">
                        <span className="text-[var(--text-muted)]">
                          {sectionIndex + 1}.
                        </span>{" "}
                        {section.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {section.lessons.length} lesson
                        {section.lessons.length === 1 ? "" : "s"}
                        {seconds > 0 && ` · ${formatDuration(seconds)}`}
                      </p>
                    </div>
                  )}

                  <div className="flex shrink-0 items-center gap-1">
                    <form action={moveSectionAction}>
                      <input type="hidden" name="sectionId" value={section.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={sectionIndex === 0}
                        aria-label="Move section up"
                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                    </form>

                    <form action={moveSectionAction}>
                      <input type="hidden" name="sectionId" value={section.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={sectionIndex === sections.length - 1}
                        aria-label="Move section down"
                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setRenamingSection(section.id)}
                      aria-label="Rename section"
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <form action={deleteSectionAction}>
                      <input type="hidden" name="sectionId" value={section.id} />
                      <button
                        type="submit"
                        aria-label="Delete section"
                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4 sm:p-5">
                    {/* Lessons */}
                    {section.lessons.length > 0 && (
                      <ul className="mb-4 space-y-2.5">
                        {section.lessons.map((lesson, lessonIndex) => (
                          <li
                            key={lesson.id}
                            className="neu-sm rounded-2xl p-3.5"
                          >
                            {editingLesson === lesson.id ? (
                              <LessonForm
                                sectionId={section.id}
                                lesson={lesson}
                                onDone={() => setEditingLesson(null)}
                              />
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="shrink-0 text-[var(--accent)]">
                                    {TYPE_ICONS[lesson.type as LessonType] ??
                                      TYPE_ICONS.VIDEO}
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                                      {lesson.title}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                                      <span>{lesson.type}</span>
                                      {lesson.durationSeconds > 0 && (
                                        <span>
                                          {formatDuration(lesson.durationSeconds)}
                                        </span>
                                      )}
                                      {lesson.type === "QUIZ" && (
                                        <span>
                                          {lesson.questions.length} question
                                          {lesson.questions.length === 1 ? "" : "s"}
                                        </span>
                                      )}
                                      {lesson.type === "VIDEO" &&
                                        !lesson.contentUrl && (
                                          <span className="text-[var(--warning)]">
                                            No video attached
                                          </span>
                                        )}
                                    </div>
                                  </div>

                                  {lesson.isPreview && (
                                    <Badge
                                      tone="accent"
                                      icon={<Eye className="h-3 w-3" />}
                                    >
                                      Preview
                                    </Badge>
                                  )}

                                  <div className="flex shrink-0 items-center gap-1">
                                    <form action={moveLessonAction}>
                                      <input
                                        type="hidden"
                                        name="lessonId"
                                        value={lesson.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="direction"
                                        value="up"
                                      />
                                      <button
                                        type="submit"
                                        disabled={lessonIndex === 0}
                                        aria-label="Move lesson up"
                                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
                                      >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                      </button>
                                    </form>

                                    <form action={moveLessonAction}>
                                      <input
                                        type="hidden"
                                        name="lessonId"
                                        value={lesson.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="direction"
                                        value="down"
                                      />
                                      <button
                                        type="submit"
                                        disabled={
                                          lessonIndex === section.lessons.length - 1
                                        }
                                        aria-label="Move lesson down"
                                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
                                      >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      </button>
                                    </form>

                                    {lesson.type === "QUIZ" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedQuiz(
                                            expandedQuiz === lesson.id
                                              ? null
                                              : lesson.id
                                          )
                                        }
                                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface-raised)]"
                                      >
                                        Questions
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setEditingLesson(lesson.id)}
                                      aria-label="Edit lesson"
                                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>

                                    <form action={deleteLessonAction}>
                                      <input
                                        type="hidden"
                                        name="lessonId"
                                        value={lesson.id}
                                      />
                                      <button
                                        type="submit"
                                        aria-label="Delete lesson"
                                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </form>
                                  </div>
                                </div>

                                {lesson.type === "QUIZ" &&
                                  expandedQuiz === lesson.id && (
                                    <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                                      <QuizEditor
                                        lessonId={lesson.id}
                                        questions={lesson.questions}
                                      />
                                    </div>
                                  )}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {addingLessonTo === section.id ? (
                      <div className="neu-inset rounded-2xl p-5">
                        <LessonForm
                          sectionId={section.id}
                          onDone={() => setAddingLessonTo(null)}
                        />
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setAddingLessonTo(section.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add lesson
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CurriculumBuilder;
