"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Route,
  Trash2,
  X,
} from "lucide-react";

import {
  deletePathAction,
  saveLearningPathAction,
  setPathPublishedAction,
  type ActionState,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { pluralize } from "@/lib/utils";

export interface PathCourseOption {
  id: string;
  title: string;
  lessonCount: number;
}

export interface ManagedPath {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  color: string;
  isPublished: boolean;
  items: { courseId: string; order: number; course: { title: string } }[];
  _count: { enrollments: number };
}

const initialState: ActionState = {};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      {label}
    </Button>
  );
}

function PathForm({
  path,
  courses,
  onDone,
}: {
  path?: ManagedPath;
  courses: PathCourseOption[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveLearningPathAction, initialState);
  const [color, setColor] = useState(path?.color ?? "#6366f1");

  // Ordered list of selected course ids — the order here is the path sequence.
  const [selected, setSelected] = useState<string[]>(
    path ? path.items.slice().sort((a, b) => a.order - b.order).map((i) => i.courseId) : []
  );

  const available = courses.filter((c) => !selected.includes(c.id));
  const titleFor = (id: string) =>
    courses.find((c) => c.id === id)?.title ?? "Unknown course";

  const move = (index: number, direction: -1 | 1) => {
    setSelected((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <form action={formAction} className="space-y-5">
      {path && <input type="hidden" name="pathId" value={path.id} />}
      {selected.map((courseId) => (
        <input key={courseId} type="hidden" name="courseIds" value={courseId} />
      ))}

      {state.errors?._form && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {state.errors._form}
        </p>
      )}
      {state.ok && <p className="text-sm text-[var(--success)]">{state.message}</p>}

      <Input
        name="title"
        label="Path title"
        placeholder="New Engineer Onboarding"
        defaultValue={path?.title ?? ""}
        error={state.errors?.title}
        required
      />

      <Textarea
        name="description"
        label="Description"
        placeholder="What this path prepares someone for, and who should take it."
        rows={3}
        defaultValue={path?.description ?? ""}
        error={state.errors?.description}
      />

      <div>
        <label
          htmlFor="path-color"
          className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
        >
          Accent colour
        </label>
        <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <input
            id="path-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          />
          <input
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full bg-transparent font-mono text-sm outline-none"
          />
        </div>
      </div>

      {/* Sequence builder */}
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
          Course sequence
        </p>

        {selected.length === 0 ? (
          <p className="neu-inset rounded-2xl p-4 text-center text-sm text-[var(--text-muted)]">
            No courses yet. Add them from the list below — order matters.
          </p>
        ) : (
          <ol className="space-y-2">
            {selected.map((courseId, index) => (
              <li
                key={courseId}
                className="neu-sm flex items-center gap-3 rounded-xl p-3"
              >
                <span className="neu-inset flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-[var(--text-muted)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
                  {titleFor(courseId)}
                </span>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === selected.length - 1}
                  aria-label="Move down"
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((current) => current.filter((id) => id !== courseId))
                  }
                  aria-label="Remove from path"
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ol>
        )}

        {available.length > 0 && (
          <div className="neu-inset mt-3 max-h-52 overflow-y-auto rounded-2xl p-2">
            {available.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setSelected((current) => [...current, course.id])}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--surface-raised)]"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
                  {course.title}
                </span>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {pluralize(course.lessonCount, "lesson")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <SaveButton label={path ? "Save path" : "Create path"} />
        <Button type="button" onClick={onDone}>
          Close
        </Button>
      </div>
    </form>
  );
}

export function PathManager({
  paths,
  courses,
}: {
  paths: ManagedPath[];
  courses: PathCourseOption[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedPath | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} variant="primary">
          <Plus className="h-4 w-4" />
          New path
        </Button>
      </div>

      {paths.length === 0 ? (
        <Card>
          <p className="py-12 text-center text-sm text-[var(--text-muted)]">
            No learning paths yet. Create one to sequence courses into a track.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paths.map((path) => (
            <Card key={path.id} elevation="sm" className="!p-4">
              <div className="flex flex-wrap items-center gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${path.color}, color-mix(in srgb, ${path.color} 50%, var(--secondary)))`,
                  }}
                >
                  <Route className="h-5 w-5 text-white" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {path.title}
                    </p>
                    <Badge tone={path.isPublished ? "success" : "warning"}>
                      {path.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {pluralize(path.items.length, "course")} ·{" "}
                    {pluralize(path._count.enrollments, "learner")}
                  </p>
                  {path.items.length > 0 && (
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                      {path.items
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((i) => i.course.title)
                        .join(" → ")}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <form action={setPathPublishedAction}>
                    <input type="hidden" name="pathId" value={path.id} />
                    <input
                      type="hidden"
                      name="publish"
                      value={path.isPublished ? "false" : "true"}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!path.isPublished && path.items.length === 0}
                      title={
                        !path.isPublished && path.items.length === 0
                          ? "Add at least one course first"
                          : undefined
                      }
                    >
                      {path.isPublished ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Publish
                        </>
                      )}
                    </Button>
                  </form>

                  <Button size="sm" onClick={() => setEditing(path)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>

                  <form action={deletePathAction}>
                    <input type="hidden" name="pathId" value={path.id} />
                    <Button type="submit" size="sm" variant="danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New learning path"
        description="Sequence published courses into a track."
        width="lg"
      >
        <PathForm courses={courses} onDone={() => setCreating(false)} />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.title}` : ""}
        width="lg"
      >
        {editing && (
          <PathForm
            path={editing}
            courses={courses}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

export default PathManager;
