"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: {
    tone?: ToastTone;
    title: string;
    description?: string;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CONFIG: Record<
  ToastTone,
  { icon: React.ReactNode; color: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "var(--success)",
  },
  error: { icon: <XCircle className="h-5 w-5" />, color: "var(--danger)" },
  warning: {
    icon: <AlertCircle className="h-5 w-5" />,
    color: "var(--warning)",
  },
  info: { icon: <Info className="h-5 w-5" />, color: "var(--info)" },
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ tone = "info", title, description }) => {
      const id = nextId++;
      setItems((current) => [...current, { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[200] flex w-full max-w-sm flex-col gap-3"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => {
          const config = TONE_CONFIG[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className="neu-lg pointer-events-auto flex animate-fade-up items-start gap-3 rounded-2xl p-4"
            >
              <span className="mt-0.5 shrink-0" style={{ color: config.color }}>
                {config.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a <ToastProvider>.");
  }
  return context;
}
