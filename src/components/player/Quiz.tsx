"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { submitQuizAction, type QuizResult } from "@/app/actions/learning";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";

export interface QuizOptionData {
  id: string;
  text: string;
}

export interface QuizQuestionData {
  id: string;
  prompt: string;
  type: string;
  points: number;
  options: QuizOptionData[];
}

/**
 * Quiz runner. Correct answers are never shipped to the browser before
 * submission — grading happens in the server action, which returns the key
 * along with the score.
 */
export function Quiz({
  lessonId,
  questions,
  priorAttempts,
  bestScore,
  alreadyPassed,
}: {
  lessonId: string;
  questions: QuizQuestionData[];
  priorAttempts: number;
  bestScore: number | null;
  alreadyPassed: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, startTransition] = useTransition();

  const maxAttempts = luminaConfig.learning.quizMaxAttempts;
  const attemptsLeft =
    maxAttempts > 0 ? Math.max(0, maxAttempts - priorAttempts) : Infinity;
  const outOfAttempts = attemptsLeft === 0;

  const answeredCount = questions.filter(
    (q) => (answers[q.id] ?? []).length > 0
  ).length;
  const allAnswered = answeredCount === questions.length;

  const toggle = (question: QuizQuestionData, optionId: string) => {
    if (result) return;
    setAnswers((current) => {
      const existing = current[question.id] ?? [];
      if (question.type === "MULTI") {
        return {
          ...current,
          [question.id]: existing.includes(optionId)
            ? existing.filter((id) => id !== optionId)
            : [...existing, optionId],
        };
      }
      // SINGLE and TRUE_FALSE are radio-style — one answer replaces the other.
      return { ...current, [question.id]: [optionId] };
    });
  };

  const submit = () => {
    startTransition(async () => {
      const outcome = await submitQuizAction(lessonId, answers);
      setResult(outcome);
      if (outcome.passed) router.refresh();
    });
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
  };

  if (questions.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          This quiz doesn&apos;t have any questions yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              <HelpCircle className="h-5 w-5 text-[var(--accent)]" />
              Knowledge check
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {questions.length} question{questions.length === 1 ? "" : "s"} ·
              Pass mark {luminaConfig.learning.quizPassingScore}%
              {maxAttempts > 0 && ` · ${maxAttempts} attempts allowed`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {alreadyPassed && (
              <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>
                Passed
              </Badge>
            )}
            {bestScore !== null && (
              <Badge tone="neutral">Best: {bestScore}%</Badge>
            )}
            {maxAttempts > 0 && !result && (
              <Badge tone={outOfAttempts ? "danger" : "neutral"}>
                {attemptsLeft} left
              </Badge>
            )}
          </div>
        </div>

        {!result && (
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                {answeredCount} of {questions.length} answered
              </span>
              <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
            </div>
            <div className="neu-inset mt-2 h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                style={{
                  width: `${(answeredCount / questions.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Result banner */}
      {result && !result.error && (
        <Card>
          <div className="flex flex-col items-center gap-6 py-4 sm:flex-row sm:items-center">
            <ProgressRing
              value={result.score}
              size={128}
              strokeWidth={11}
              color={result.passed ? "var(--success)" : "var(--danger)"}
            >
              <span className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                {result.score}%
              </span>
            </ProgressRing>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h3
                className="text-2xl font-bold tracking-tight"
                style={{
                  color: result.passed ? "var(--success)" : "var(--danger)",
                }}
              >
                {result.passed ? "You passed" : "Not quite"}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                {result.passed
                  ? "This lesson is marked complete. Review the explanations below if you'd like."
                  : `You need ${luminaConfig.learning.quizPassingScore}% to pass. Check the explanations and try again.`}
              </p>

              {!result.passed &&
                (maxAttempts === 0 || maxAttempts - result.attemptNo > 0) && (
                  <Button onClick={retry} variant="primary" className="mt-4">
                    <RotateCcw className="h-4 w-4" />
                    Try again
                    {maxAttempts > 0 &&
                      ` (${maxAttempts - result.attemptNo} left)`}
                  </Button>
                )}
            </div>
          </div>
        </Card>
      )}

      {result?.error && (
        <Card>
          <p className="flex items-center gap-2.5 text-sm text-[var(--danger)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {result.error}
          </p>
        </Card>
      )}

      {/* Questions */}
      {questions.map((question, index) => {
        const selected = answers[question.id] ?? [];
        const graded = result && !result.error;
        const wasCorrect = graded ? result.correctByQuestion[question.id] : null;
        const correctIds = graded ? result.correctOptionIds[question.id] ?? [] : [];
        const explanation = graded ? result.explanations[question.id] : null;

        return (
          <Card key={question.id}>
            <div className="mb-4 flex items-start gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                  graded
                    ? wasCorrect
                      ? "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]"
                      : "bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)]"
                    : "neu-inset text-[var(--text-muted)]"
                )}
              >
                {graded ? (
                  wasCorrect ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )
                ) : (
                  index + 1
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-medium leading-relaxed text-[var(--text-primary)]">
                  {question.prompt}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {question.type === "MULTI"
                    ? "Select all that apply"
                    : "Select one"}
                  {question.points > 1 && ` · ${question.points} points`}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {question.options.map((option) => {
                const isSelected = selected.includes(option.id);
                const isCorrect = correctIds.includes(option.id);

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(result) || pending}
                    onClick={() => toggle(question, option.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-all duration-200",
                      graded
                        ? isCorrect
                          ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--text-primary)] ring-1 ring-[var(--success)]"
                          : isSelected
                            ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--text-primary)] ring-1 ring-[var(--danger)]"
                            : "neu-flat text-[var(--text-secondary)]"
                        : isSelected
                          ? "neu-pressed text-[var(--accent)]"
                          : "neu-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-all",
                        question.type === "MULTI" ? "rounded-md" : "rounded-full",
                        graded
                          ? isCorrect
                            ? "border-[var(--success)] bg-[var(--success)]"
                            : isSelected
                              ? "border-[var(--danger)] bg-[var(--danger)]"
                              : "border-[var(--text-muted)] opacity-40"
                          : isSelected
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-[var(--text-muted)] opacity-50"
                      )}
                    >
                      {(isSelected || (graded && isCorrect)) && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </span>
                    {option.text}
                  </button>
                );
              })}
            </div>

            {explanation && (
              <div className="mt-4 rounded-2xl bg-[var(--surface-sunken)] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Explanation
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {explanation}
                </p>
              </div>
            )}
          </Card>
        );
      })}

      {!result && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[var(--text-muted)]">
              {allAnswered
                ? "All questions answered. Ready when you are."
                : `Answer all ${questions.length} questions to submit.`}
            </p>
            <Button
              onClick={submit}
              variant="primary"
              size="lg"
              disabled={!allAnswered || outOfAttempts}
              loading={pending}
            >
              Submit answers
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default Quiz;
