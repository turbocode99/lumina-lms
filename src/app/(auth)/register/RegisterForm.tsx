"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Briefcase, Building2, Lock, Mail, User } from "lucide-react";

import { registerAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.errors?._form && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.errors._form}</span>
        </div>
      )}

      <Input
        name="name"
        label="Full name"
        placeholder="Ada Lovelace"
        autoComplete="name"
        icon={<User className="h-4 w-4" />}
        error={state.errors?.name}
        required
        autoFocus
      />

      <Input
        name="email"
        type="email"
        label="Work email"
        placeholder="you@company.com"
        autoComplete="email"
        icon={<Mail className="h-4 w-4" />}
        error={state.errors?.email}
        required
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          name="title"
          label="Job title"
          placeholder="Software Engineer"
          autoComplete="organization-title"
          icon={<Briefcase className="h-4 w-4" />}
          error={state.errors?.title}
        />
        <Input
          name="department"
          label="Department"
          placeholder="Engineering"
          icon={<Building2 className="h-4 w-4" />}
          error={state.errors?.department}
        />
      </div>

      <Input
        name="password"
        type="password"
        label="Password"
        placeholder="At least 8 characters"
        autoComplete="new-password"
        icon={<Lock className="h-4 w-4" />}
        error={state.errors?.password}
        required
      />

      <Input
        name="confirmPassword"
        type="password"
        label="Confirm password"
        placeholder="Re-enter your password"
        autoComplete="new-password"
        icon={<Lock className="h-4 w-4" />}
        error={state.errors?.confirmPassword}
        required
      />

      <SubmitButton />
    </form>
  );
}

export default RegisterForm;
