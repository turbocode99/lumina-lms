"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Lock, Mail } from "lucide-react";

import { loginAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

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
        name="email"
        type="email"
        label="Work email"
        placeholder="you@company.com"
        autoComplete="email"
        icon={<Mail className="h-4 w-4" />}
        error={state.errors?.email}
        required
        autoFocus
      />

      <Input
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        autoComplete="current-password"
        icon={<Lock className="h-4 w-4" />}
        error={state.errors?.password}
        required
      />

      <SubmitButton />
    </form>
  );
}

export default LoginForm;
