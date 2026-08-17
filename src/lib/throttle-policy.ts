/**
 * Login throttling policy — the decision, with no IO.
 *
 * Deliberately separate from `throttle.ts`, which reads the database and request
 * headers and is therefore `server-only`. Keeping the arithmetic here means the
 * limits, the rolling window, and the retry-after calculation can be exercised
 * directly instead of inferred from the rows the wrapper happens to write.
 */

/** Failures allowed against one account within the window before lockout. */
export const MAX_ATTEMPTS_PER_EMAIL = 8;

/** Failures allowed from one address within the window, across all accounts. */
export const MAX_ATTEMPTS_PER_IP = 30;

/** Rolling window, in minutes. */
export const WINDOW_MINUTES = 15;

export interface ThrottleState {
  blocked: boolean;
  /** Seconds until the next attempt is permitted. */
  retryAfterSeconds: number;
  /** Attempts remaining against this account before lockout. */
  remaining: number;
  /** Which limit tripped, for logging and messaging. */
  reason: "none" | "email" | "ip";
}

export function evaluateThrottle(input: {
  emailCount: number;
  ipCount: number;
  /** Timestamp of the oldest attempt still inside the window, if any. */
  oldestAttemptAt: Date | null;
  now?: Date;
}): ThrottleState {
  const now = input.now ?? new Date();

  const emailTripped = input.emailCount >= MAX_ATTEMPTS_PER_EMAIL;
  const ipTripped = input.ipCount >= MAX_ATTEMPTS_PER_IP;

  if (!emailTripped && !ipTripped) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
      remaining: Math.max(0, MAX_ATTEMPTS_PER_EMAIL - input.emailCount),
      reason: "none",
    };
  }

  // The lockout lifts as the oldest attempt ages out, so the window rolls rather
  // than releasing every locked account at a fixed interval.
  const unlockAt = input.oldestAttemptAt
    ? input.oldestAttemptAt.getTime() + WINDOW_MINUTES * 60_000
    : now.getTime();

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((unlockAt - now.getTime()) / 1000)),
    remaining: 0,
    reason: emailTripped ? "email" : "ip",
  };
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export const THROTTLE_LIMITS = {
  perEmail: MAX_ATTEMPTS_PER_EMAIL,
  perIp: MAX_ATTEMPTS_PER_IP,
  windowMinutes: WINDOW_MINUTES,
};
