"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Package, Upload } from "lucide-react";

import { importScormAction } from "@/app/actions/authoring";
import { Button } from "@/components/ui/Button";

/**
 * Uploads a SCORM .zip against an existing lesson.
 *
 * Unlike the other uploaders this cannot run until the lesson has been saved:
 * the import writes a package row and points the lesson at it, so it needs a
 * lesson id. New lessons therefore get an explanation rather than a file input.
 */

interface Props {
  lessonId: string | null;
  current?: {
    title: string;
    version: string;
    fileCount: number;
    sizeBytes: number;
  } | null;
}

function mb(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ScormUpload({ lessonId, current }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!lessonId) {
    return (
      <div className="neu-inset flex items-start gap-3 rounded-2xl p-4 text-sm text-[var(--text-secondary)]">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <span>
          Save the lesson first, then upload the package. The import needs a lesson
          to attach itself to.
        </span>
      </div>
    );
  }

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setDone(null);

    const data = new FormData();
    data.set("lessonId", lessonId);
    data.set("file", file);

    try {
      const result = await importScormAction(data);
      if (result.ok) {
        setDone(
          `${result.packageTitle} — SCORM ${result.version}, ${result.fileCount} files`
        );
      } else {
        setError(result.error ?? "The package could not be imported.");
      }
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          loading={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {current ? "Replace package" : "Upload SCORM package"}
        </Button>
        <span className="text-xs text-[var(--text-muted)]">
          A .zip exported from Storyline, Rise, Captivate or similar. SCORM 1.2 or 2004.
        </span>
      </div>

      {current && !done && (
        <div className="neu-inset flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-sm">
          <span className="font-medium text-[var(--text-primary)]">{current.title}</span>
          <span className="text-[var(--text-muted)]">SCORM {current.version}</span>
          <span className="text-[var(--text-muted)]">
            {current.fileCount} files · {mb(current.sizeBytes)}
          </span>
        </div>
      )}

      {done && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--success)_12%,transparent)] p-3 text-sm text-[var(--success)]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Imported: {done}</span>
        </div>
      )}

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

export default ScormUpload;
