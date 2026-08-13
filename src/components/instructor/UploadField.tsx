"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Upload, X } from "lucide-react";

import { uploadMediaAction } from "@/app/actions/authoring";
import { Label } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

/**
 * Upload control that writes the resulting URL into a hidden input, so the
 * surrounding form submits a plain string and never has to handle the file
 * itself. Also accepts a pasted external URL — useful when video already lives
 * on an internal CDN or streaming service.
 */
export function UploadField({
  name,
  label,
  kind,
  defaultValue = "",
  hint,
  accept,
}: {
  name: string;
  label: string;
  kind: "image" | "video" | "resource";
  defaultValue?: string;
  hint?: string;
  accept?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (file: File) => {
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", kind);

    startTransition(async () => {
      const result = await uploadMediaAction(formData);
      if (result.ok && result.url) setUrl(result.url);
      else setError(result.error ?? "Upload failed.");
    });
  };

  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={url} />

      <div className="neu-inset flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="neu-interactive flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin-slow" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {pending ? "Uploading…" : "Choose file"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={
            accept ??
            (kind === "video"
              ? "video/mp4,video/webm,video/quicktime"
              : kind === "resource"
                ? "application/pdf,application/zip,image/*"
                : "image/*")
          }
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />

        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste a URL"
          aria-label={`${label} URL`}
          className="min-w-[180px] flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
        />

        {url && (
          <button
            type="button"
            onClick={() => setUrl("")}
            aria-label="Clear"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {url && !pending && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--success)]">
          <Check className="h-3 w-3" />
          File attached
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{hint}</p>
      )}

      {/* Thumbnail preview */}
      {kind === "image" && url && (
        <div className={cn("mt-3 overflow-hidden rounded-xl", "neu-sm")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="aspect-video w-full object-cover" />
        </div>
      )}
    </div>
  );
}

export default UploadField;
