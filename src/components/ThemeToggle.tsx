"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

const STORAGE_KEY = "lumina-theme";

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }
}

/**
 * Three-way theme switch. `system` removes the attribute entirely so the
 * `prefers-color-scheme` block in globals.css takes over; the explicit values
 * stamp `data-theme`, which wins over the media query.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setMode(stored);
    }
    setMounted(true);
  }, []);

  const choose = (next: Mode) => {
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyMode(next);
  };

  const options: { value: Mode; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="h-4 w-4" />, label: "Light" },
    { value: "dark", icon: <Moon className="h-4 w-4" />, label: "Dark" },
    { value: "system", icon: <Monitor className="h-4 w-4" />, label: "System" },
  ];

  if (compact) {
    // Cycles light → dark → system. Used in the topbar where space is tight.
    const current = options.find((o) => o.value === mode) ?? options[2];
    return (
      <button
        type="button"
        onClick={() => {
          const index = options.findIndex((o) => o.value === mode);
          choose(options[(index + 1) % options.length].value);
        }}
        aria-label={`Theme: ${current.label}. Click to change.`}
        title={`Theme: ${current.label}`}
        className="neu-interactive flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)]"
      >
        {mounted ? current.icon : <Monitor className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div
      className="neu-inset flex gap-1 rounded-2xl p-1.5"
      role="radiogroup"
      aria-label="Colour theme"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mounted && mode === option.value}
          onClick={() => choose(option.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-250",
            mounted && mode === option.value
              ? "neu-sm text-[var(--accent)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Inlined in <head> so the stored theme is applied before first paint. Without
 * it, a dark-mode user sees a white flash on every navigation.
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;

export default ThemeToggle;
