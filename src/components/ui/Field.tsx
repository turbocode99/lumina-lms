"use client";

import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Form controls. All of them render as inset wells — the neumorphic convention
 * for "this accepts input" — with the accent ring appearing only on focus.
 */

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn(
        "mb-2 block text-sm font-medium text-[var(--text-secondary)]",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-[var(--danger)]">*</span>}
    </label>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--danger)]">
      {message}
    </p>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-[var(--text-muted)]">{children}</p>;
}

const CONTROL_BASE =
  "w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, icon, className, containerClassName, id, required, ...props },
    ref
  ) => {
    const generated = useId();
    const inputId = id ?? generated;
    return (
      <div className={containerClassName}>
        {label && (
          <Label htmlFor={inputId} required={required}>
            {label}
          </Label>
        )}
        <div
          className={cn(
            "neu-input neu-inset flex items-center gap-2.5 rounded-2xl px-4 py-3 transition-shadow",
            error && "ring-2 ring-[var(--danger)]/45",
            className
          )}
        >
          {icon && (
            <span className="shrink-0 text-[var(--text-muted)]">{icon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? true : undefined}
            className={CONTROL_BASE}
            {...props}
          />
        </div>
        <FieldError message={error} />
        {hint && !error && <FieldHint>{hint}</FieldHint>}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: React.ReactNode;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, hint, className, containerClassName, id, required, rows = 4, ...props },
    ref
  ) => {
    const generated = useId();
    const inputId = id ?? generated;
    return (
      <div className={containerClassName}>
        {label && (
          <Label htmlFor={inputId} required={required}>
            {label}
          </Label>
        )}
        <div
          className={cn(
            "neu-input neu-inset rounded-2xl px-4 py-3 transition-shadow",
            error && "ring-2 ring-[var(--danger)]/45",
            className
          )}
        >
          <textarea
            ref={ref}
            id={inputId}
            rows={rows}
            required={required}
            aria-invalid={error ? true : undefined}
            className={cn(CONTROL_BASE, "resize-y leading-relaxed")}
            {...props}
          />
        </div>
        <FieldError message={error} />
        {hint && !error && <FieldHint>{hint}</FieldHint>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  hint?: React.ReactNode;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, hint, className, containerClassName, id, required, children, ...props },
    ref
  ) => {
    const generated = useId();
    const inputId = id ?? generated;
    return (
      <div className={containerClassName}>
        {label && (
          <Label htmlFor={inputId} required={required}>
            {label}
          </Label>
        )}
        <div
          className={cn(
            "neu-input neu-inset relative flex items-center rounded-2xl px-4 py-3 transition-shadow",
            error && "ring-2 ring-[var(--danger)]/45",
            className
          )}
        >
          <select
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? true : undefined}
            className={cn(
              CONTROL_BASE,
              "cursor-pointer appearance-none pr-7 [&>option]:bg-[var(--surface)] [&>option]:text-[var(--text-primary)]"
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 h-4 w-4 text-[var(--text-muted)]"
            aria-hidden
          />
        </div>
        <FieldError message={error} />
        {hint && !error && <FieldHint>{hint}</FieldHint>}
      </div>
    );
  }
);
Select.displayName = "Select";

/** Neumorphic checkbox — the box presses in when checked. */
export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  description?: string;
}) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        type="checkbox"
        id={id}
        className="peer sr-only"
        {...props}
      />
      <label
        htmlFor={id}
        className={cn(
          "neu-sm mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md",
          "transition-all duration-200",
          "peer-checked:neu-inset peer-checked:bg-[var(--accent)]",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]",
          "peer-disabled:opacity-50"
        )}
      >
        <svg
          viewBox="0 0 14 14"
          className="h-3 w-3 scale-0 text-white opacity-0 transition-all duration-200 peer-checked:scale-100 peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 7.5 5.5 11 12 3.5" />
        </svg>
      </label>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && (
            <span className="block text-sm font-medium text-[var(--text-primary)]">
              {label}
            </span>
          )}
          {description && (
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              {description}
            </span>
          )}
        </label>
      )}
    </div>
  );
}

/** Pill toggle used for feature switches in settings and the course builder. */
export function Switch({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  description?: string;
}) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && (
            <span className="block text-sm font-medium text-[var(--text-primary)]">
              {label}
            </span>
          )}
          {description && (
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              {description}
            </span>
          )}
        </label>
      )}
      <input type="checkbox" id={id} className="peer sr-only" {...props} />
      <label
        htmlFor={id}
        className={cn(
          "neu-inset relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-300",
          "peer-checked:bg-[var(--accent)]",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]",
          "peer-disabled:opacity-50",
          "after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full",
          "after:bg-[var(--surface)] after:shadow-[2px_2px_5px_var(--shadow-dark),-1px_-1px_4px_var(--shadow-light)]",
          "after:transition-transform after:duration-300 peer-checked:after:translate-x-5"
        )}
      />
    </div>
  );
}
