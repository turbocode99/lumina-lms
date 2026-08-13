"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  // Gradient fill + glow: the one high-emphasis treatment on any given screen.
  primary: "neu-accent font-semibold",
  // Raised soft surface: the default for everything else.
  secondary: "neu-interactive text-[var(--text-primary)] font-medium",
  // No extrusion until hover, for dense toolbars where shadows would collide.
  ghost:
    "bg-transparent text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors",
  danger:
    "neu-interactive text-[var(--danger)] font-semibold hover:text-[var(--danger)]",
  success:
    "neu-interactive text-[var(--success)] font-semibold hover:text-[var(--success)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-13 px-7 text-base rounded-2xl gap-2.5",
  icon: "h-11 w-11 rounded-2xl justify-center",
};

const BASE =
  "inline-flex items-center justify-center select-none whitespace-nowrap " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export interface ButtonLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

/** Same visual language as Button, for navigation rather than actions. */
export function ButtonLink({
  href,
  className,
  variant = "secondary",
  size = "md",
  fullWidth = false,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export default Button;
