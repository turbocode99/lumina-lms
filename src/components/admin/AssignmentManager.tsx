"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarClock, ClipboardCheck, Search, Send, Users } from "lucide-react";

import {
  assignTrainingAction,
  type ActionState,
} from "@/app/actions/admin";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
  avatarUrl: string | null;
}

export interface AssignableTarget {
  id: string;
  title: string;
}

const initialState: ActionState = {};

function AssignButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      loading={pending}
      disabled={count === 0}
    >
      <Send className="h-4 w-4" />
      Assign to {count} {count === 1 ? "person" : "people"}
    </Button>
  );
}

export function AssignmentManager({
  users,
  courses,
  paths,
  departments,
}: {
  users: AssignableUser[];
  courses: AssignableTarget[];
  paths: AssignableTarget[];
  departments: string[];
}) {
  const [state, formAction] = useActionState(assignTrainingAction, initialState);
  const [targetKind, setTargetKind] = useState<"course" | "path">("course");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (departmentFilter && user.department !== departmentFilter) return false;
      if (!needle) return true;
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle)
      );
    });
  }, [users, query, departmentFilter]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  const toggleAllFiltered = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const user of filtered) next.delete(user.id);
      } else {
        for (const user of filtered) next.add(user.id);
      }
      return next;
    });

  return (
    <Card data-tour="assign-form">
      <CardTitle className="mb-5 flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-[var(--accent)]" />
        Assign required training
      </CardTitle>

      <form action={formAction} className="space-y-6">
        {Array.from(selected).map((userId) => (
          <input key={userId} type="hidden" name="userIds" value={userId} />
        ))}

        {state.errors?._form && (
          <p
            role="alert"
            className="rounded-2xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]"
          >
            {state.errors._form}
          </p>
        )}
        {state.errors?.userIds && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {state.errors.userIds}
          </p>
        )}
        {state.ok && (
          <p className="rounded-2xl bg-[color-mix(in_srgb,var(--success)_12%,transparent)] p-4 text-sm text-[var(--success)]">
            {state.message}
          </p>
        )}

        {/* What to assign */}
        <div>
          <p className="mb-2.5 text-sm font-medium text-[var(--text-secondary)]">
            What are you assigning?
          </p>
          <div className="neu-inset mb-4 inline-flex gap-1 rounded-2xl p-1.5">
            {(["course", "path"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setTargetKind(kind)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                  targetKind === kind
                    ? "neu-sm text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {kind === "course" ? "A course" : "A learning path"}
              </button>
            ))}
          </div>

          {targetKind === "course" ? (
            <>
              <Select name="courseId" label="Course" error={state.errors?.courseId} required>
                <option value="">Choose a course…</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
              <input type="hidden" name="pathId" value="" />
            </>
          ) : (
            <>
              <Select name="pathId" label="Learning path" error={state.errors?.pathId} required>
                <option value="">Choose a path…</option>
                {paths.map((path) => (
                  <option key={path.id} value={path.id}>
                    {path.title}
                  </option>
                ))}
              </Select>
              <input type="hidden" name="courseId" value="" />
            </>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            name="dueAt"
            type="date"
            label="Due date (optional)"
            icon={<CalendarClock className="h-4 w-4" />}
            error={state.errors?.dueAt}
          />
          <Textarea
            name="note"
            label="Note (optional)"
            placeholder="Why this is required, or any context."
            rows={1}
            error={state.errors?.note}
          />
        </div>

        {/* Who */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
              <Users className="h-4 w-4" />
              Who needs it?
              {selected.size > 0 && (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                  {selected.size} selected
                </span>
              )}
            </p>

            <Button type="button" size="sm" onClick={toggleAllFiltered}>
              {allFilteredSelected ? "Deselect all" : "Select all shown"}
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap gap-3">
            <div className="neu-inset neu-input flex min-w-[200px] flex-1 items-center gap-2.5 rounded-2xl px-4 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                aria-label="Search people"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>

            {departments.length > 0 && (
              <div className="neu-inset neu-input flex items-center rounded-2xl px-4 py-2.5">
                <label htmlFor="dept-filter" className="sr-only">
                  Filter by department
                </label>
                <select
                  id="dept-filter"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="cursor-pointer bg-transparent text-sm outline-none [&>option]:bg-[var(--surface)]"
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="neu-inset max-h-72 overflow-y-auto rounded-2xl p-2">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--text-muted)]">
                Nobody matches those filters.
              </p>
            ) : (
              filtered.map((user) => {
                const isSelected = selected.has(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggle(user.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                        : "hover:bg-[var(--surface-raised)]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--text-muted)] opacity-50"
                      )}
                    >
                      {isSelected && (
                        <svg
                          viewBox="0 0 14 14"
                          className="h-3 w-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <path d="M2 7.5 5.5 11 12 3.5" />
                        </svg>
                      )}
                    </span>

                    <Avatar name={user.name} src={user.avatarUrl} size="xs" />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">
                        {user.email}
                      </span>
                    </span>

                    {user.department && (
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">
                        {user.department}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <AssignButton count={selected.size} />
      </form>
    </Card>
  );
}

export default AssignmentManager;
