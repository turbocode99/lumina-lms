"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Runs an imported SCORM package and gives it somewhere to report to.
 *
 * SCORM content does not accept an API from us. On start-up it walks up
 * `window.parent` looking for a global — `API` for 1.2, `API_1484_11` for 2004 —
 * and gives up if it does not find one within a few levels. So the object has to
 * exist on this window *before* the iframe loads, which is why the effect that
 * installs it runs before the frame src is set.
 *
 * Every method returns a string, not a boolean. Content checks `=== "true"`,
 * and returning a real boolean is the single most common reason a package
 * silently refuses to start.
 */

type Cmi = Record<string, string>;

interface Props {
  packageId: string;
  lessonId: string;
  version: "1.2" | "2004";
  launchUrl: string;
  title: string;
}

const ERR_NONE = "0";
const ERR_NOT_INITIALISED = "301";
const ERR_GENERAL = "101";

export function ScormPlayer({ packageId, lessonId, version, launchUrl, title }: Props) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string>("not attempted");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs, not state: the API object is read synchronously by the content and
  // must never see a stale closure.
  const cmiRef = useRef<Cmi>({});
  const dirtyRef = useRef(false);
  const initialisedRef = useRef(false);
  const lastErrorRef = useRef(ERR_NONE);

  useEffect(() => {
    let cancelled = false;
    const stateUrl = `/api/scorm/${packageId}/state`;

    const commit = async (viaBeacon = false) => {
      if (!dirtyRef.current) return true;
      const payload = JSON.stringify({ lessonId, cmi: cmiRef.current });
      dirtyRef.current = false;

      // On unload nothing else survives; a beacon is queued by the browser and
      // sent after the page is gone.
      if (viaBeacon && typeof navigator.sendBeacon === "function") {
        return navigator.sendBeacon(stateUrl, new Blob([payload], { type: "application/json" }));
      }

      try {
        setSaving(true);
        const res = await fetch(stateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled && json.status) setStatus(String(json.status));
        return true;
      } catch {
        // Re-arm so the next commit retries rather than dropping the attempt.
        dirtyRef.current = true;
        if (!cancelled) setError("Could not save progress. It will retry.");
        return false;
      } finally {
        if (!cancelled) setSaving(false);
      }
    };

    const api = {
      // --- SCORM 1.2 ---
      LMSInitialize: (): string => {
        initialisedRef.current = true;
        lastErrorRef.current = ERR_NONE;
        return "true";
      },
      LMSFinish: (): string => {
        void commit();
        initialisedRef.current = false;
        return "true";
      },
      LMSGetValue: (key: string): string => {
        if (!initialisedRef.current) {
          lastErrorRef.current = ERR_NOT_INITIALISED;
          return "";
        }
        lastErrorRef.current = ERR_NONE;
        return cmiRef.current[key] ?? "";
      },
      LMSSetValue: (key: string, value: string): string => {
        if (!initialisedRef.current) {
          lastErrorRef.current = ERR_NOT_INITIALISED;
          return "false";
        }
        cmiRef.current[key] = String(value ?? "");
        dirtyRef.current = true;
        lastErrorRef.current = ERR_NONE;
        return "true";
      },
      LMSCommit: (): string => {
        void commit();
        lastErrorRef.current = ERR_NONE;
        return "true";
      },
      LMSGetLastError: (): string => lastErrorRef.current,
      LMSGetErrorString: (code: string): string =>
        code === ERR_NOT_INITIALISED ? "Not initialized" : code === ERR_GENERAL ? "General exception" : "No error",
      LMSGetDiagnostic: (code: string): string => code,
    };

    // 2004 renames every method and adds nothing this player needs, so it maps
    // onto the same implementation.
    const api2004 = {
      Initialize: api.LMSInitialize,
      Terminate: api.LMSFinish,
      GetValue: api.LMSGetValue,
      SetValue: api.LMSSetValue,
      Commit: api.LMSCommit,
      GetLastError: api.LMSGetLastError,
      GetErrorString: api.LMSGetErrorString,
      GetDiagnostic: api.LMSGetDiagnostic,
    };

    const w = window as unknown as Record<string, unknown>;
    // Both are exposed regardless of the declared version: packages mis-declare
    // themselves often enough that refusing the other API buys nothing.
    w.API = api;
    w.API_1484_11 = api2004;

    // Seed the model from the last attempt so the content can resume.
    (async () => {
      try {
        const res = await fetch(`${stateUrl}?lessonId=${encodeURIComponent(lessonId)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.state?.cmi && typeof json.state.cmi === "object") {
            cmiRef.current = { ...(json.state.cmi as Cmi) };
            if (json.state.lessonStatus) setStatus(String(json.state.lessonStatus));
          }
        }
      } catch {
        // A failed restore costs the bookmark, not the lesson.
      } finally {
        // Entry mode tells well-behaved content whether to offer "resume".
        const resumable = Boolean(cmiRef.current["cmi.suspend_data"] || cmiRef.current["cmi.core.lesson_location"]);
        cmiRef.current["cmi.core.entry"] = resumable ? "resume" : "ab-initio";
        cmiRef.current["cmi.entry"] = resumable ? "resume" : "ab-initio";
        if (!cancelled) setReady(true);
      }
    })();

    const onHide = () => { if (document.visibilityState === "hidden") void commit(true); };
    const onUnload = () => { void commit(true); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onUnload);

    // Content that never calls LMSCommit is common; this bounds how much a
    // learner can lose to a closed tab.
    const ticker = window.setInterval(() => { void commit(); }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(ticker);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
      void commit(true);
      delete w.API;
      delete w.API_1484_11;
    };
  }, [packageId, lessonId]);

  const complete = status === "completed" || status === "passed";

  return (
    <div className="space-y-3">
      <div className="neu-inset relative overflow-hidden rounded-[var(--radius-neu)]" style={{ aspectRatio: "16 / 9" }}>
        {ready ? (
          <iframe
            src={launchUrl}
            title={title}
            className="absolute inset-0 h-full w-full border-0 bg-white"
            // The package is same-origin so it can reach window.parent for the
            // API. allow-same-origin without allow-scripts would stop it running
            // at all; both are required for SCORM to work.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            allow="autoplay; fullscreen; microphone; camera"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gap-2.5 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden />
            Loading course…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium",
            complete
              ? "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]"
              : "neu-inset text-[var(--text-secondary)]"
          )}
        >
          {complete && <CheckCircle2 className="h-4 w-4" aria-hidden />}
          {status === "not attempted" ? "Not started" :
            status === "incomplete" ? "In progress" :
            status.charAt(0).toUpperCase() + status.slice(1)}
        </span>

        <span className="text-xs text-[var(--text-muted)]">
          SCORM {version} · progress is reported by the course itself
        </span>

        {saving && (
          <span className="ml-auto text-xs text-[var(--text-muted)]">Saving…</span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-3 text-sm text-[var(--danger)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default ScormPlayer;
