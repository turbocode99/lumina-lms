import "server-only";

import { headers } from "next/headers";

import { db } from "@/lib/db";
import {
  evaluateThrottle,
  MAX_ATTEMPTS_PER_EMAIL,
  MAX_ATTEMPTS_PER_IP,
  WINDOW_MINUTES,
  type ThrottleState,
} from "@/lib/throttle-policy";

/**
 * Login throttling — the IO half.
 *
 * Credential auth without a rate limit is brute-forceable, and the endpoint is
 * only as strong as the weakest password anyone has set; a short password falls in
 * seconds against an unthrottled login. This bounds attempts per account and per
 * client address.
 *
 * Counters live in the database rather than in memory so the limit survives a
 * restart and holds across multiple instances behind a load balancer, where a
 * per-process counter would let an attacker simply spread attempts out.
 *
 * The decision itself is in `throttle-policy.ts`, which has no IO and is tested
 * directly.
 */

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MINUTES * 60_000);
}

/**
 * Best-effort client address. Behind a proxy this is only as trustworthy as the
 * proxy setting it, which is why the per-account limit — unavoidable by rotating
 * addresses — is the primary control and the per-address limit is secondary.
 */
async function clientIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return list.get("x-real-ip") ?? null;
}

/** Whether this account/address may attempt a sign-in right now. */
export async function checkLoginAllowed(email: string): Promise<ThrottleState> {
  const since = windowStart();
  const ip = await clientIp();

  const [emailCount, ipCount] = await Promise.all([
    db.loginAttempt.count({ where: { email, createdAt: { gte: since } } }),
    ip
      ? db.loginAttempt.count({ where: { ip, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ]);

  const emailTripped = emailCount >= MAX_ATTEMPTS_PER_EMAIL;
  const ipTripped = ipCount >= MAX_ATTEMPTS_PER_IP;

  // Only needed when something has tripped, so the common path stays two counts.
  const oldest =
    emailTripped || ipTripped
      ? await db.loginAttempt.findFirst({
          where: {
            createdAt: { gte: since },
            ...(emailTripped ? { email } : { ip }),
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        })
      : null;

  return evaluateThrottle({
    emailCount,
    ipCount,
    oldestAttemptAt: oldest?.createdAt ?? null,
  });
}

/** Records a failure. Called for wrong passwords and unknown emails alike. */
export async function recordFailedLogin(email: string): Promise<void> {
  const ip = await clientIp();
  await db.loginAttempt.create({ data: { email, ip } });

  // Opportunistic pruning: cheap, and avoids a scheduled job for a small,
  // self-expiring table.
  if (Math.random() < 0.1) {
    await db.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    });
  }
}

/** Clears the counter for an account after a successful sign-in. */
export async function clearFailedLogins(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { email } });
}

export { formatRetryAfter, THROTTLE_LIMITS } from "@/lib/throttle-policy";
export type { ThrottleState } from "@/lib/throttle-policy";
