"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { MessageSquarePlus, Star } from "lucide-react";

import { saveReviewAction, type ActionState } from "@/app/actions/learning";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Rating, RatingInput } from "@/components/ui/Rating";
import { formatRelative } from "@/lib/utils";

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: { name: string; avatarUrl: string | null; title: string | null };
}

const initialState: ActionState = {};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      {editing ? "Update review" : "Post review"}
    </Button>
  );
}

export function ReviewSection({
  courseId,
  reviews,
  ratingAvg,
  ratingCount,
  canReview,
  myReview,
}: {
  courseId: string;
  reviews: ReviewItem[];
  ratingAvg: number;
  ratingCount: number;
  canReview: boolean;
  myReview: { rating: number; comment: string | null } | null;
}) {
  const [state, formAction] = useActionState(saveReviewAction, initialState);
  const [showForm, setShowForm] = useState(false);

  // Distribution bars — how many reviews sit at each star level.
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <div className="shrink-0 text-center">
            <p className="text-5xl font-bold tabular-nums text-[var(--warning)]">
              {ratingAvg > 0 ? ratingAvg.toFixed(1) : "—"}
            </p>
            <Rating
              value={ratingAvg}
              size="md"
              showValue={false}
              className="mt-2 justify-center"
            />
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {ratingCount.toLocaleString()}{" "}
              {ratingCount === 1 ? "rating" : "ratings"}
            </p>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {distribution.map(({ star, count }) => {
              const percent = reviews.length
                ? Math.round((count / reviews.length) * 100)
                : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="flex w-10 shrink-0 items-center gap-1 text-xs text-[var(--text-muted)]">
                    {star}
                    <Star className="h-3 w-3 fill-[var(--warning)] text-[var(--warning)]" />
                  </span>
                  <div className="neu-inset h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-[var(--warning)] transition-[width] duration-700"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {canReview && !showForm && (
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <Button onClick={() => setShowForm(true)}>
              <MessageSquarePlus className="h-4 w-4" />
              {myReview ? "Edit your review" : "Write a review"}
            </Button>
          </div>
        )}
      </Card>

      {/* Form */}
      {canReview && showForm && (
        <Card>
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="courseId" value={courseId} />

            {state.errors?._form && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {state.errors._form}
              </p>
            )}
            {state.ok && (
              <p className="text-sm text-[var(--success)]">{state.message}</p>
            )}

            <div>
              <p className="mb-2.5 text-sm font-medium text-[var(--text-secondary)]">
                How would you rate this course?
              </p>
              <RatingInput defaultValue={myReview?.rating ?? 0} />
              {state.errors?.rating && (
                <p className="mt-1.5 text-xs text-[var(--danger)]">
                  {state.errors.rating}
                </p>
              )}
            </div>

            <Textarea
              name="comment"
              label="Your review (optional)"
              placeholder="What worked well? What would you change?"
              defaultValue={myReview?.comment ?? ""}
              rows={4}
              error={state.errors?.comment}
            />

            <div className="flex gap-3">
              <SubmitButton editing={Boolean(myReview)} />
              <Button type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      {reviews.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">
          No reviews yet. Be the first to share what you thought.
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} elevation="sm">
              <div className="flex gap-4">
                <Avatar
                  name={review.user.name}
                  src={review.user.avatarUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {review.user.name}
                    </p>
                    <Rating value={review.rating} size="sm" showValue={false} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatRelative(review.createdAt)}
                    </span>
                  </div>
                  {review.user.title && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {review.user.title}
                    </p>
                  )}
                  {review.comment && (
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                      {review.comment}
                    </p>
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

export default ReviewSection;
