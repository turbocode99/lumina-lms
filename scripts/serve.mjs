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
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "./lib/env.mjs";
import { parsePort, preferredHost, resolvePort } from "./lib/port.mjs";

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

/* --- Anchor a relative SQLite database to the project ---------------------- */

/**
 * Prisma resolves a relative SQLite path against the schema directory. The
 * standalone bundle contains its own copy of `prisma/`, so `file:./dev.db` inside
 * it means `.next/standalone/prisma/dev.db` — a different file from the
 * `prisma/dev.db` that `db:seed` and `set-admin` write to.
 *
 * Worse, the build traces the database as a dependency and copies it into the
 * bundle, so the server comes up on a snapshot frozen at build time: CLI changes
 * are invisible to the app, and anything the app writes is discarded by the next
 * build. Nothing errors, which is what makes it nasty.
 *
 * Rewriting the URL to an absolute path pins both to the same file. Absolute
 * URLs (including the container's `file:/app/data/lumina.db`) pass through
 * untouched.
 */
const databaseUrl = process.env.DATABASE_URL;
let resolvedDatabase = null;

if (databaseUrl?.startsWith("file:")) {
  const rawPath = databaseUrl.slice("file:".length);

  if (!isAbsolute(rawPath)) {
    const absolute = resolve(join(root, "prisma"), rawPath);
    process.env.DATABASE_URL = `file:${absolute}`;
    resolvedDatabase = absolute;

    // Remove the traced copy so a future change here cannot silently fall back
    // to a stale bundled database.
    const bundledName = rawPath.replace(/^\.\//, "");
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      rmSync(join(standalone, "prisma", `${bundledName}${suffix}`), { force: true });
    }
  }
}

/* --- Run ------------------------------------------------------------------ */

// Resolved after the port, since choosing the address requires a test bind.
let hostname = "0.0.0.0";

const requested = parsePort(process.env.PORT);
const { port, moved } = await resolvePort({
  preferred: requested,
  strict: strictPort,
});

hostname = await preferredHost(port);

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

if (resolvedDatabase) {
  console.log(`  ${c.dim}database  ${resolvedDatabase}${c.reset}`);
}

console.log(
  `  ${c.dim}also http://localhost:${port}${
    hostname === "::" ? ` and http://[::1]:${port}` : ""
  }${c.reset}`
);

if (hostname !== "::") {
  console.log(
    `  ${c.dim}IPv4 only (bound ${hostname}) — http://[::1]:${port} will not connect.${c.reset}`
  );
}

console.log("");

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
