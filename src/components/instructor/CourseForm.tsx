"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createCourseAction,
  updateCourseAction,
  type ActionState,
} from "@/app/actions/authoring";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { COURSE_LEVELS } from "@/lib/enums";

import { UploadField } from "./UploadField";

export interface CourseFormValues {
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  categoryId: string;
  level: string;
  language: string;
  objectives: string;
  requirements: string;
  audience: string;
  tags: string;
  isMandatory: boolean;
}

const initialState: ActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Shared by the create and edit flows. Multi-value fields (objectives,
 * requirements, audience) are entered one-per-line and split server-side.
 */
export function CourseForm({
  values,
  categories,
  canSetMandatory,
  mode,
}: {
  values?: Partial<CourseFormValues>;
  categories: { id: string; name: string }[];
  canSetMandatory: boolean;
  mode: "create" | "edit";
}) {
  const [state, formAction] = useActionState(
    mode === "create" ? createCourseAction : updateCourseAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      {values?.id && <input type="hidden" name="courseId" value={values.id} />}

      {state.errors?._form && (
        <p
          role="alert"
          className="rounded-2xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]"
        >
          {state.errors._form}
        </p>
      )}
      {state.ok && (
        <p className="rounded-2xl bg-[color-mix(in_srgb,var(--success)_12%,transparent)] p-4 text-sm text-[var(--success)]">
          {state.message}
        </p>
      )}

      <Input
        name="title"
        label="Course title"
        placeholder="Secure Coding Fundamentals"
        defaultValue={values?.title ?? ""}
        error={state.errors?.title}
        required
      />

      <Input
        name="subtitle"
        label="Subtitle"
        placeholder="A one-line summary that shows on the catalog card"
        defaultValue={values?.subtitle ?? ""}
        error={state.errors?.subtitle}
      />

      <Textarea
        name="description"
        label="Description"
        placeholder="What this course covers, and why it matters for your team."
        rows={6}
        defaultValue={values?.description ?? ""}
        error={state.errors?.description}
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Select
          name="categoryId"
          label="Category"
          defaultValue={values?.categoryId ?? ""}
          error={state.errors?.categoryId}
        >
          <option value="">Uncategorised</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Select
          name="level"
          label="Level"
          defaultValue={values?.level ?? "All Levels"}
          error={state.errors?.level}
        >
          {COURSE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>

        <Input
          name="language"
          label="Language"
          defaultValue={values?.language ?? "English"}
          error={state.errors?.language}
        />
      </div>

      <Textarea
        name="objectives"
        label="What learners will be able to do"
        placeholder={"One per line:\nSpot the OWASP Top 10 in a code review\nWrite parameterised queries by default"}
        rows={5}
        defaultValue={values?.objectives ?? ""}
        hint="One outcome per line. These render as the checklist on the course page."
        error={state.errors?.objectives}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Textarea
          name="requirements"
          label="Requirements"
          placeholder={"One per line:\nBasic familiarity with JavaScript"}
          rows={4}
          defaultValue={values?.requirements ?? ""}
          hint="One per line."
          error={state.errors?.requirements}
        />

        <Textarea
          name="audience"
          label="Who this is for"
          placeholder={"One per line:\nBackend engineers\nNew joiners in their first month"}
          rows={4}
          defaultValue={values?.audience ?? ""}
          hint="One per line."
          error={state.errors?.audience}
        />
      </div>

      <Input
        name="tags"
        label="Tags"
        placeholder="security, code review, owasp"
        defaultValue={values?.tags ?? ""}
        hint="Comma separated. Tags feed the catalog search."
        error={state.errors?.tags}
      />

      {/* Create only. On the edit page the Media tab owns the thumbnail, so
          showing a second control here would let two fields fight over it. */}
      {mode === "create" && (
        <UploadField
          name="thumbnailUrl"
          label="Thumbnail"
          kind="image"
          hint="Optional — 16:9, around 1280×720. You can add or change it later from the course's Media tab."
        />
      )}

      {canSetMandatory && (
        <div className="neu-inset rounded-2xl p-5">
          <Checkbox
            name="isMandatory"
            defaultChecked={values?.isMandatory ?? false}
            label="Mark as required training"
            description="Flags the course as compliance training across the catalog and dashboards. Assigning it to specific people is done from the admin console."
          />
        </div>
      )}

      <SubmitButton
        label={mode === "create" ? "Create course" : "Save changes"}
      />
    </form>
  );
}

export default CourseForm;
