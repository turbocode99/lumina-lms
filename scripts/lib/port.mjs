/**
 * Port resolution shared by `npm run dev` and `npm start`.
 *
 * Neither Next.js entry point handles a taken port acceptably here: the
 * standalone server dies with EADDRINUSE, and `next dev` was observed printing
 * its banner for the occupied port and then never becoming ready — a silent
 * hang, which is worse than an error. So both launchers probe first.
 *
 * The probe checks IPv4 and IPv6 separately, which matters more than it sounds.
 * Windows keeps the two stacks independent: a server bound to 0.0.0.0 does not
 * occupy ::1, so probing only `localhost` (which resolves to ::1 first) reports
 * a port as free while a real server is answering on it over IPv4. An earlier
 * version of this file did exactly that and happily handed out a port already in
 * use. A port now counts as free only when it is free on every family that
 * actually exists on the machine.
 */

import { createServer } from "node:net";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};

/**
 * Default port for dev and production.
 *
 * Deliberately not 3000. That is the default for Next.js, Create React App, and
 * Rails, so on any machine doing other web work it is usually already taken.
 * 4400 avoids the other usual suspects too — 4000 (Phoenix), 5000 (Flask, and
 * macOS AirPlay Receiver), 5173 (Vite), 7000 (AirPlay), 8000 (Django), 8080
 * (Tomcat and most everything else).
 *
 * This is the single source of truth. The Dockerfile, compose file, and launch
 * config all use the same number; changing it here means changing it there too,
 * and the README says so.
 */
export const DEFAULT_PORT = 4400;

/**
 * Ports never handed out, even when explicitly requested — a request for one is
 * redirected to DEFAULT_PORT with a note. 3000 is listed because it collides with
 * so many other dev servers that landing on it tends to mean fighting something
 * else for it.
 */
const EXCLUDED_PORTS = new Set([3000]);

/** How far to scan upward before giving up. */
const SCAN_RANGE = 40;

/**
 * Wildcard addresses for both families. Binding the wildcard fails if anything
 * holds the port on any address in that family, including a loopback-only
 * listener, which is the behaviour we want.
 */
const PROBE_HOSTS = ["0.0.0.0", "::"];

/** Errors that mean "something is already here". Anything else means the family isn't testable. */
const IN_USE_CODES = new Set(["EADDRINUSE", "EACCES"]);

function probeHost(port, host) {
  return new Promise((resolve) => {
    const probe = createServer();

    probe.once("error", (error) => {
      if (IN_USE_CODES.has(error.code)) {
        resolve("in-use");
      } else {
        // EAFNOSUPPORT / EINVAL / EADDRNOTAVAIL: this family is unavailable on
        // this host, so it tells us nothing about whether the port is free.
        resolve("untestable");
      }
    });

    probe.once("listening", () => probe.close(() => resolve("free")));

    // `exclusive` stops the probe succeeding via SO_REUSEADDR on a port another
    // process in this group already holds.
    probe.listen({ port, host, exclusive: true });
  });
}

/**
 * True only if no address family reports the port in use. `hostname` is accepted
 * for call-site clarity but deliberately not probed directly — a hostname can
 * resolve to one family while the server binds another, which is the bug this
 * function exists to avoid.
 */
export async function isPortFree(port) {
  const results = await Promise.all(PROBE_HOSTS.map((host) => probeHost(port, host)));
  return !results.includes("in-use");
}

export function parsePort(raw, fallback = DEFAULT_PORT) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error(
      `\n${c.red}${c.bold}Invalid PORT: ${raw}${c.reset}\n\n` +
        `Use an integer between 1 and 65535.\n`
    );
    process.exit(1);
  }
  if (EXCLUDED_PORTS.has(parsed)) {
    console.log(
      `\n  ${c.yellow}Port ${parsed} is excluded, so ${fallback} is used instead.${c.reset}\n` +
        `  ${c.dim}It collides with too many other dev servers to be a safe default.${c.reset}`
    );
    return fallback;
  }
  return parsed;
}

/**
 * Returns the first free port at or above `preferred`.
 *
 * `strict` fails instead of moving — the right behaviour in a container or
 * behind a reverse proxy, where the port is part of the contract and silently
 * moving would leave the proxy pointing at nothing.
 */
export async function resolvePort({ preferred, strict = false }) {
  // Callers normally pass a value already through parsePort, but guard anyway so
  // an excluded port cannot slip in from a direct call.
  const start = EXCLUDED_PORTS.has(preferred) ? DEFAULT_PORT : preferred;

  if (await isPortFree(start)) {
    return { port: start, moved: start !== preferred };
  }
  preferred = start;

  if (strict) {
    console.error(
      `\n${c.red}${c.bold}Port ${preferred} is already in use.${c.reset}\n\n` +
        `--strict-port was passed, so no alternative was tried.\n` +
        `Free the port, or choose another:\n\n` +
        `    ${c.bold}PORT=${preferred + 1} npm start${c.reset}\n`
    );
    process.exit(1);
  }

  const ceiling = Math.min(preferred + SCAN_RANGE, 65535);
  for (let candidate = preferred + 1; candidate <= ceiling; candidate++) {
    // An excluded port is never a valid destination, even mid-scan.
    if (EXCLUDED_PORTS.has(candidate)) continue;
    if (await isPortFree(candidate)) {
      return { port: candidate, moved: true };
    }
  }

  console.error(
    `\n${c.red}${c.bold}No free port found.${c.reset}\n\n` +
      `Tried ${preferred} through ${ceiling}. Set one explicitly:\n\n` +
      `    ${c.bold}PORT=8080 npm start${c.reset}\n`
  );
  process.exit(1);
}
