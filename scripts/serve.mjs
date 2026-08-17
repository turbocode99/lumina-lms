#!/usr/bin/env node

/**
 * Production server launcher.
 *
 * `next.config.ts` sets `output: "standalone"`, which keeps the Docker image
 * small but means plain `next start` does not work — Next.js prints
 * "next start does not work with output: standalone" and serves nothing useful.
 * The standalone bundle is a self-contained `server.js`, but Next.js
 * deliberately does not copy static assets into it, so it has to be assembled:
 *
 *   .next/standalone/server.js      ← emitted by the build
 *   .next/standalone/.next/static/  ← must be copied from .next/static
 *   .next/standalone/public/        ← must be copied from public
 *
 * The Dockerfile does these copies as explicit COPY layers. This script does the
 * same thing for bare-metal and local hosting, so `npm start` behaves the way
 * the README says it does.
 *
 * It also picks a free port, since the standalone server otherwise dies with
 * EADDRINUSE. Pass `--strict-port` to fail instead of moving, which is what you
 * want in a container or behind a reverse proxy where the port is part of the
 * contract. Shared with the dev launcher via scripts/lib/port.mjs.
 */

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "./lib/env.mjs";
import { parsePort, resolvePort } from "./lib/port.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");

// Read PORT (and anything else) from .env before the server starts, since plain
// Node does not load it. Shell values still win.
loadEnvFile(join(root, ".env"));

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
};

// In a container or behind a reverse proxy the port is part of the contract, so
// silently moving would be worse than failing loudly.
const strictPort = process.argv.includes("--strict-port");

if (!existsSync(join(root, ".next", "BUILD_ID"))) {
  console.error(
    `\n${c.red}${c.bold}No production build found.${c.reset}\n\n` +
      `Run this first:\n\n    ${c.bold}npm run build${c.reset}\n`
  );
  process.exit(1);
}

if (!existsSync(join(standalone, "server.js"))) {
  console.error(
    `\n${c.red}${c.bold}The standalone bundle is missing.${c.reset}\n\n` +
      `next.config.ts sets output: "standalone", so the build should have emitted\n` +
      `.next/standalone/server.js. Try a clean rebuild:\n\n` +
      `    ${c.bold}npm run build${c.reset}\n`
  );
  process.exit(1);
}

/* --- Assemble the bundle -------------------------------------------------- */

// Copied on every start rather than cached: a rebuild replaces .next/static with
// new content-hashed filenames, and a stale copy here serves 404s for every
// stylesheet and chunk.
const staticSrc = join(root, ".next", "static");
if (existsSync(staticSrc)) {
  const dest = join(standalone, ".next", "static");
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(staticSrc, dest, { recursive: true });
}

const publicSrc = join(root, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(standalone, "public"), { recursive: true });
}

/* --- Run ------------------------------------------------------------------ */

// 0.0.0.0 binds IPv4 only. That is right for containers and LAN access, but on
// systems that resolve `localhost` to IPv6 ::1 first — Windows does — visiting
// http://localhost fails with a connection error while the server is perfectly
// healthy. So the URL printed below is 127.0.0.1, which always resolves to the
// interface actually being listened on.
const hostname = process.env.HOSTNAME || "0.0.0.0";

const requested = parsePort(process.env.PORT);
const { port, moved } = await resolvePort({
  preferred: requested,
  strict: strictPort,
});

console.log(
  `\n${c.green}${c.bold}Lumina LMS${c.reset} ${c.dim}(production)${c.reset}\n\n` +
    `  ${c.cyan}http://127.0.0.1:${port}${c.reset}\n`
);

if (moved) {
  console.log(
    `  ${c.yellow}Port ${requested} was already in use, so ${port} was used instead.${c.reset}\n` +
      `  ${c.dim}Pass --strict-port to fail instead of moving.${c.reset}\n`
  );
}

console.log(
  `  ${c.dim}Bound to ${hostname}:${port}. If http://localhost:${port} refuses to\n` +
    `  connect, use the address above — localhost may resolve to IPv6 first.${c.reset}\n`
);

const child = spawn(process.execPath, [join(standalone, "server.js")], {
  cwd: standalone,
  stdio: "inherit",
  // PORT must be the resolved port, not the requested one, and env values have
  // to be strings — a number here is silently dropped on some Node versions.
  env: { ...process.env, PORT: String(port), HOSTNAME: hostname },
});

// Forward signals so Ctrl-C and `docker stop` shut the server down cleanly
// instead of orphaning the child.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code) => process.exit(code ?? 0));
