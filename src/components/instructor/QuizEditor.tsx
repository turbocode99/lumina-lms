"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { HelpCircle, Plus, Trash2, X } from "lucide-react";

import {
  deleteQuizQuestionAction,
  saveQuizQuestionAction,
  type ActionState,
} from "@/app/actions/authoring";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { QUESTION_TYPES } from "@/lib/enums";
import { cn } from "@/lib/utils";

export interface EditableOption {
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface EditableQuestion {
  id: string;
  prompt: string;
  type: string;
  explanation: string | null;
  points: number;
  options: { id: string; text: string; isCorrect: boolean }[];
}

const initialState: ActionState = {};

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" loading={pending}>
      {editing ? "Update question" : "Add question"}
    </Button>
  );
}

function QuestionForm({
  lessonId,
  question,
  onDone,
}: {
  lessonId: string;
  question?: EditableQuestion;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveQuizQuestionAction, initialState);
  const [type, setType] = useState(question?.type ?? "SINGLE");
  const [options, setOptions] = useState<EditableOption[]>(
    question?.options.length
      ? question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
      : [
          { text: "", isCorrect: true },
          { text: "", isCorrect: false },
        ]
  );

  // True/false is a fixed two-option shape; swapping type rewrites the options.
  const applyType = (next: string) => {
    setType(next);
    if (next === "TRUE_FALSE") {
      setOptions([
        { text: "True", isCorrect: true },
        { text: "False", isCorrect: false },
      ]);
    }
  };

  const setCorrect = (index: number, checked: boolean) => {
    setOptions((current) =>
      current.map((option, i) => {
        if (type === "MULTI") {
          return i === index ? { ...option, isCorrect: checked } : option;
        }
        // Single-answer types: selecting one clears the rest.
        return { ...option, isCorrect: i === index };
      })
    );
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      {question && <input type="hidden" name="questionId" value={question.id} />}

      {state.errors?._form && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {state.errors._form}
        </p>
      )}
      {state.ok && (
        <p className="text-sm text-[var(--success)]">{state.message}</p>
      )}

      <Textarea
        name="prompt"
        label="Question"
        placeholder="What should the learner be able to answer?"
        rows={2}
        defaultValue={question?.prompt ?? ""}
        error={state.errors?.prompt}
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="type"
          label="Answer type"
          value={type}
          onChange={(e) => applyType(e.target.value)}
        >
          {QUESTION_TYPES.map((option) => (
            <option key={option} value={option}>
              {option === "SINGLE"
                ? "Single choice"
                : option === "MULTI"
                  ? "Multiple choice"
                  : "True / False"}
            </option>
          ))}
        </Select>

        <Input
          name="points"
          type="number"
          min={1}
          max={20}
          label="Points"
          defaultValue={question?.points ?? 1}
          error={state.errors?.points}
        />
      </div>

      <div>
        <Label>Options</Label>
        {state.errors?.options && (
          <p className="mb-2 text-xs text-[var(--danger)]">
            {state.errors.options}
          </p>
        )}

        <div className="space-y-2.5">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                name="optionCorrect"
                value={index}
                checked={option.isCorrect}
                onChange={(e) => setCorrect(index, e.target.checked)}
                aria-label={`Option ${index + 1} is correct`}
                className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              />

              <div className="neu-inset neu-input flex-1 rounded-xl px-3.5 py-2.5">
                <input
                  name="optionText"
                  value={option.text}
                  readOnly={type === "TRUE_FALSE"}
                  onChange={(e) =>
                    setOptions((current) =>
                      current.map((o, i) =>
                        i === index ? { ...o, text: e.target.value } : o
                      )
                    )
                  }
                  placeholder={`Option ${index + 1}`}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                />
              </div>

              {type !== "TRUE_FALSE" && options.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setOptions((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove option ${index + 1}`}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {type !== "TRUE_FALSE" && options.length < 8 && (
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() =>
              setOptions((current) => [...current, { text: "", isCorrect: false }])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add option
          </Button>
        )}

        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Tick the checkbox next to every correct answer.
        </p>
      </div>

      <Textarea
        name="explanation"
        label="Explanation (optional)"
        placeholder="Shown after grading, so learners understand the answer."
        rows={2}
        defaultValue={question?.explanation ?? ""}
        error={state.errors?.explanation}
      />

      <div className="flex gap-3">
        <SaveButton editing={Boolean(question)} />
        <Button type="button" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function QuizEditor({
  lessonId,
  questions,
}: {
  lessonId: string;
  questions: EditableQuestion[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalPoints = questions.reduce((acc, q) => acc + q.points, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="h-4 w-4 text-[var(--accent)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Quiz questions
          </p>
          {questions.length > 0 && (
            <Badge tone="neutral">
              {questions.length} · {totalPoints} pts
            </Badge>
          )}
        </div>

        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add question
          </Button>
        )}
      </div>

      {adding && (
        <div className="neu-inset rounded-2xl p-5">
          <QuestionForm lessonId={lessonId} onDone={() => setAdding(false)} />
        </div>
      )}

      {questions.length === 0 && !adding ? (
        <p className="rounded-2xl bg-[var(--surface-sunken)] p-5 text-center text-sm text-[var(--text-muted)]">
          No questions yet. A quiz lesson needs at least one to be useful.
        </p>
      ) : (
        <ol className="space-y-2.5">
          {questions.map((question, index) => (
            <li key={question.id} className="neu-sm rounded-2xl p-4">
              {editingId === question.id ? (
                <QuestionForm
                  lessonId={lessonId}
                  question={question}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <span className="neu-inset flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-[var(--text-muted)]">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {question.prompt}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {question.options.map((option) => (
                        <li
                          key={option.id}
                          className={cn(
                            "flex items-center gap-2 text-xs",
                            option.isCorrect
                              ? "font-medium text-[var(--success)]"
                              : "text-[var(--text-muted)]"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              option.isCorrect
                                ? "bg-[var(--success)]"
                                : "bg-[var(--text-muted)] opacity-40"
                            )}
                          />
                          {option.text}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {question.type === "MULTI"
                        ? "Multiple choice"
                        : question.type === "TRUE_FALSE"
                          ? "True / False"
                          : "Single choice"}{" "}
                      · {question.points} pt{question.points === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(question.id)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface-raised)]"
                    >
                      Edit
                    </button>
                    <form action={deleteQuizQuestionAction}>
                      <input
                        type="hidden"
                        name="questionId"
                        value={question.id}
                      />
                      <button
                        type="submit"
                        aria-label="Delete question"
                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default QuizEditor;
