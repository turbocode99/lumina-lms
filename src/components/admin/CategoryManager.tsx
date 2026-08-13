"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";

import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
  type ActionState,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { pluralize } from "@/lib/utils";

export interface ManagedCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string | null;
  _count: { courses: number };
}

const initialState: ActionState = {};

/** lucide icon names that read well as category glyphs. */
const ICON_SUGGESTIONS = [
  "BookOpen",
  "Rocket",
  "Code2",
  "Palette",
  "BarChart3",
  "Users",
  "ShieldCheck",
  "TrendingUp",
  "Sparkles",
  "Briefcase",
  "Globe",
  "Wrench",
];

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      <Plus className="h-4 w-4" />
      Add category
    </Button>
  );
}

export function CategoryManager({
  categories,
}: {
  categories: ManagedCategory[];
}) {
  const [state, formAction] = useActionState(createCategoryAction, initialState);
  const [color, setColor] = useState("#6366f1");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Create */}
      <Card>
        <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          <Plus className="h-5 w-5 text-[var(--accent)]" />
          New category
        </h2>

        <form action={formAction} className="space-y-5">
          {state.errors?._form && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {state.errors._form}
            </p>
          )}
          {state.ok && (
            <p className="text-sm text-[var(--success)]">{state.message}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              name="name"
              label="Name"
              placeholder="Compliance & Safety"
              error={state.errors?.name}
              required
            />

            <div>
              <label
                htmlFor="new-category-color"
                className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Colour
              </label>
              <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-2.5">
                <input
                  id="new-category-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  aria-label="Category colour"
                />
                <input
                  name="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-transparent font-mono text-sm outline-none"
                />
              </div>
              {state.errors?.color && (
                <p className="mt-1.5 text-xs text-[var(--danger)]">
                  {state.errors.color}
                </p>
              )}
            </div>
          </div>

          <Input
            name="icon"
            label="Icon"
            defaultValue="BookOpen"
            hint={`A lucide-react icon name. Try: ${ICON_SUGGESTIONS.slice(0, 6).join(", ")}`}
            error={state.errors?.icon}
          />

          <Input
            name="description"
            label="Description (optional)"
            placeholder="Mandatory training on workplace policy and safety."
            error={state.errors?.description}
          />

          <AddButton />
        </form>
      </Card>

      {/* List */}
      {categories.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">
            No categories yet. Add one above to start organising the catalog.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Card key={category.id} elevation="sm" className="!p-4">
              {editingId === category.id ? (
                <form
                  action={updateCategoryAction}
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={() => setEditingId(null)}
                >
                  <input type="hidden" name="categoryId" value={category.id} />

                  <div className="min-w-[200px] flex-1">
                    <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                      Name
                    </label>
                    <div className="neu-inset rounded-xl px-3.5 py-2.5">
                      <input
                        name="name"
                        defaultValue={category.name}
                        autoFocus
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                      Colour
                    </label>
                    <input
                      name="color"
                      type="color"
                      defaultValue={category.color}
                      className="neu-inset h-11 w-16 cursor-pointer rounded-xl border-0 bg-transparent p-1"
                      aria-label="Category colour"
                    />
                  </div>

                  <div className="min-w-[140px]">
                    <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                      Icon
                    </label>
                    <div className="neu-inset rounded-xl px-3.5 py-2.5">
                      <input
                        name="icon"
                        defaultValue={category.icon}
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>

                  <Button type="submit" variant="primary" size="sm">
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <span
                    className="neu-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ color: category.color }}
                  >
                    <FolderTree className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {category.name}
                      </p>
                      <Badge tone="outline">
                        {pluralize(category._count.courses, "course")}
                      </Badge>
                    </div>
                    {category.description && (
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {category.description}
                      </p>
                    )}
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                      {category.color} · {category.icon}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(category.id)}
                      aria-label={`Edit ${category.name}`}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <form action={deleteCategoryAction}>
                      <input
                        type="hidden"
                        name="categoryId"
                        value={category.id}
                      />
                      <button
                        type="submit"
                        aria-label={`Delete ${category.name}`}
                        className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryManager;
