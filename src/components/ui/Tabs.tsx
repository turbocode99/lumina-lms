"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  content: React.ReactNode;
}

/**
 * Tab bar sits in an inset well; the selected tab is a raised pill inside it,
 * which is the neumorphic equivalent of an underline.
 */
export function Tabs({
  items,
  defaultTab,
  className,
  onChange,
}: {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);

  const select = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        className="neu-inset mb-6 flex gap-1 overflow-x-auto rounded-2xl p-1.5"
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              onClick={() => select(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-250",
                selected
                  ? "neu-sm text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {item.icon}
              {item.label}
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    selected
                      ? "bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)]"
                      : "bg-[var(--surface-sunken)] text-[var(--text-muted)]"
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          id={`panel-${item.id}`}
          role="tabpanel"
          hidden={item.id !== active}
          className={item.id === active ? "animate-fade-in" : undefined}
        >
          {item.id === active && item.content}
        </div>
      ))}
    </div>
  );
}

export default Tabs;
