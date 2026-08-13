"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  changePasswordAction,
  updateProfileAction,
  type ActionState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import type { SessionUser } from "@/lib/auth";

const initialState: ActionState = {};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      {label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.errors?._form) {
    return (
      <p role="alert" className="text-sm text-[var(--danger)]">
        {state.errors._form}
      </p>
    );
  }
  if (state.ok) {
    return <p className="text-sm text-[var(--success)]">{state.message}</p>;
  }
  return null;
}

export function ProfileForm({ user }: { user: SessionUser }) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Feedback state={state} />

      <Input
        name="name"
        label="Full name"
        defaultValue={user.name}
        error={state.errors?.name}
        required
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          name="title"
          label="Job title"
          placeholder="Senior Engineer"
          defaultValue={user.title ?? ""}
          error={state.errors?.title}
        />
        <Input
          name="department"
          label="Department"
          placeholder="Engineering"
          defaultValue={user.department ?? ""}
          error={state.errors?.department}
        />
      </div>

      <Input
        name="headline"
        label="Headline"
        placeholder="Shown on courses you author"
        defaultValue={user.headline ?? ""}
        hint="A one-line summary that appears next to your name on course pages."
        error={state.errors?.headline}
      />

      <Textarea
        name="bio"
        label="Bio"
        placeholder="A short introduction for learners taking your courses."
        rows={5}
        defaultValue={user.bio ?? ""}
        error={state.errors?.bio}
      />

      <SaveButton label="Save changes" />
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-5" key={state.ok ? "done" : "edit"}>
      <Feedback state={state} />

      <Input
        name="currentPassword"
        type="password"
        label="Current password"
        autoComplete="current-password"
        error={state.errors?.currentPassword}
        required
      />
      <Input
        name="newPassword"
        type="password"
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={state.errors?.newPassword}
        required
      />
      <Input
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        error={state.errors?.confirmPassword}
        required
      />

      <SaveButton label="Change password" />
    </form>
  );
}
