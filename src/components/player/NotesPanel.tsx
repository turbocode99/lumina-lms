"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { NotebookPen, Trash2 } from "lucide-react";

import {
  deleteNoteAction,
  saveNoteAction,
  type ActionState,
} from "@/app/actions/learning";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { formatRelative, formatTimecode } from "@/lib/utils";

export interface NoteItem {
  id: string;
  body: string;
  timestampSeconds: number;
  createdAt: Date;
}

const initialState: ActionState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" loading={pending}>
      Save note
    </Button>
  );
}

export function NotesPanel({
  lessonId,
  notes,
  isVideo,
}: {
  lessonId: string;
  notes: NoteItem[];
  isVideo: boolean;
}) {
  const [state, formAction] = useActionState(saveNoteAction, initialState);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-3" key={notes.length}>
        <input type="hidden" name="lessonId" value={lessonId} />
        {/* Server-side default of 0 is fine; capturing the exact playhead would
            require lifting player state, which isn't worth the coupling. */}
        <input type="hidden" name="timestampSeconds" value={0} />

        <Textarea
          name="body"
          placeholder="Jot down anything you want to come back to…"
          rows={3}
          error={state.errors?.body ?? state.errors?._form}
          required
        />
        <div className="flex items-center gap-3">
          <SaveButton />
          {state.ok && (
            <span className="text-xs text-[var(--success)]">{state.message}</span>
          )}
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <NotebookPen className="mb-3 h-8 w-8 text-[var(--text-muted)] opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            No notes for this lesson yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="neu-sm rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                    {note.body}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {isVideo && note.timestampSeconds > 0 && (
                      <span className="mr-2 font-medium text-[var(--accent)]">
                        {formatTimecode(note.timestampSeconds)}
                      </span>
                    )}
                    {formatRelative(note.createdAt)}
                  </p>
                </div>

                <form action={deleteNoteAction}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <button
                    type="submit"
                    aria-label="Delete note"
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NotesPanel;
