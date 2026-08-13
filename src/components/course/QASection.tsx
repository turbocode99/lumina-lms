"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, MessageCircleQuestion, Reply } from "lucide-react";

import {
  answerQuestionAction,
  askQuestionAction,
  type ActionState,
} from "@/app/actions/learning";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatRelative } from "@/lib/utils";

export interface QAAnswer {
  id: string;
  body: string;
  createdAt: Date;
  isAccepted: boolean;
  user: { id: string; name: string; avatarUrl: string | null };
}

export interface QAQuestion {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  resolved: boolean;
  user: { id: string; name: string; avatarUrl: string | null };
  answers: QAAnswer[];
}

const initialState: ActionState = {};

function AskButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      Post question
    </Button>
  );
}

function ReplyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" loading={pending}>
      Reply
    </Button>
  );
}

function AnswerForm({ questionId }: { questionId: string }) {
  const [state, formAction] = useActionState(answerQuestionAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="questionId" value={questionId} />
      <Textarea
        name="body"
        placeholder="Write your answer…"
        rows={3}
        error={state.errors?.body ?? state.errors?._form}
        required
      />
      <ReplyButton />
    </form>
  );
}

export function QASection({
  courseId,
  lessonId,
  questions,
  canPost,
  instructorId,
}: {
  courseId: string;
  lessonId?: string;
  questions: QAQuestion[];
  canPost: boolean;
  instructorId: string;
}) {
  const [state, formAction] = useActionState(askQuestionAction, initialState);
  const [showForm, setShowForm] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {canPost && (
        <>
          {showForm ? (
            <Card>
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="courseId" value={courseId} />
                {lessonId && (
                  <input type="hidden" name="lessonId" value={lessonId} />
                )}

                {state.errors?._form && (
                  <p role="alert" className="text-sm text-[var(--danger)]">
                    {state.errors._form}
                  </p>
                )}
                {state.ok && (
                  <p className="text-sm text-[var(--success)]">{state.message}</p>
                )}

                <Input
                  name="title"
                  label="Question"
                  placeholder="What are you stuck on?"
                  error={state.errors?.title}
                  required
                />
                <Textarea
                  name="body"
                  label="Details"
                  placeholder="Add context — what you tried, what you expected, where it went wrong."
                  rows={4}
                  error={state.errors?.body}
                  required
                />

                <div className="flex gap-3">
                  <AskButton />
                  <Button type="button" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Button onClick={() => setShowForm(true)} variant="primary">
              <MessageCircleQuestion className="h-4 w-4" />
              Ask a question
            </Button>
          )}
        </>
      )}

      {questions.length === 0 ? (
        <EmptyState
          icon={<MessageCircleQuestion className="h-9 w-9" />}
          title="No questions yet"
          description={
            canPost
              ? "Ask the first one — the instructor and your colleagues get notified."
              : "Enroll in this course to join the discussion."
          }
        />
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <Card key={question.id} elevation="sm">
              <div className="flex gap-4">
                <Avatar
                  name={question.user.name}
                  src={question.user.avatarUrl}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {question.user.name}
                    </p>
                    {question.user.id === instructorId && (
                      <Badge tone="info">Instructor</Badge>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatRelative(question.createdAt)}
                    </span>
                    {question.resolved && (
                      <Badge
                        tone="success"
                        icon={<CheckCircle2 className="h-3 w-3" />}
                      >
                        Resolved
                      </Badge>
                    )}
                  </div>

                  <h4 className="mt-2 font-semibold text-[var(--text-primary)]">
                    {question.title}
                  </h4>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                    {question.body}
                  </p>

                  {question.answers.length > 0 && (
                    <div className="mt-5 space-y-4 border-l-2 border-[var(--border-subtle)] pl-4">
                      {question.answers.map((answer) => (
                        <div key={answer.id} className="flex gap-3">
                          <Avatar
                            name={answer.user.name}
                            src={answer.user.avatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {answer.user.name}
                              </p>
                              {answer.user.id === instructorId && (
                                <Badge tone="info">Instructor</Badge>
                              )}
                              <span className="text-xs text-[var(--text-muted)]">
                                {formatRelative(answer.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                              {answer.body}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {canPost && (
                    <div className="mt-4">
                      {replyTo === question.id ? (
                        <AnswerForm questionId={question.id} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReplyTo(question.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          <Reply className="h-3.5 w-3.5" />
                          {question.answers.length > 0 ? "Add an answer" : "Answer"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default QASection;
