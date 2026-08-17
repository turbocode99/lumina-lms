#!/usr/bin/env node

/**
 * One-command local setup.
 *
 * Exists because the previous `setup` script chained Prisma commands directly,
 * which fails on a fresh clone with `P1012 Environment variable not found:
 * DATABASE_URL` — `.env` is gitignored, so it simply isn't there yet. That is a
 * mechanical problem with a mechanical fix, so this script does the fix rather
 * than reporting it: it provisions `.env` from the template, mints a real
 * AUTH_SECRET, then runs generate → push → seed.
 *
 * Safe to re-run. An existing `.env` is never overwritten, and only a
 * placeholder AUTH_SECRET is replaced.
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PORT } from "./lib/port.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const examplePath = join(root, ".env.example");

// Any AUTH_SECRET matching one of these is treated as unset. The .env.example
// placeholder is long enough to pass the length check in src/lib/auth.ts, so
// without this it would silently become a real (and shared, and public)
// production secret.
const PLACEHOLDER_SECRETS = [
  "replace-me-with-a-long-random-string-at-least-32-chars",
  "dev-only-secret-change-me-in-production-9f3a7c21e8b4",
  "build-time-placeholder-not-used-at-runtime",
  "changeme",
];

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const ok = (msg) => console.log(`${c.green}✓${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}→${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}!${c.reset} ${msg}`);
const dim = (msg) => console.log(`  ${c.dim}${msg}${c.reset}`);

function fail(message, hint) {
  console.error(`\n${c.red}${c.bold}Setup failed.${c.reset} ${message}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

/**
 * Runs a command, streaming output, and aborts with context on failure.
 *
 * `shell: true` is needed because npx is a `.cmd` shim on Windows, and Node
 * refuses to spawn those directly. The command is passed as one pre-composed
 * string rather than a command plus an args array — with `shell: true` the two
 * forms behave identically, but the args form triggers a DEP0190 warning about
 * unescaped concatenation. Every string here is a literal defined in this file,
 * so there is nothing to escape.
 */
function run(commandLine, label) {
  info(label);
  const result = spawnSync(commandLine, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    fail(
      `Could not run \`${commandLine}\`.`,
      `Is Node.js installed and on your PATH?\n  ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    fail(
      `\`${commandLine}\` exited with code ${result.status}.`,
      "The command's own output is above — that usually says what went wrong."
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 1. Environment file                                                        */
/* -------------------------------------------------------------------------- */

console.log(`\n${c.bold}Lumina LMS — setup${c.reset}\n`);

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    fail(
      "Neither .env nor .env.example exists.",
      "Your checkout looks incomplete. Try a fresh `git clone`."
    );
  }
  writeFileSync(envPath, readFileSync(examplePath, "utf8"));
  ok("Created .env from .env.example");
} else {
  dim(".env already exists — leaving it alone");
}

let env = readFileSync(envPath, "utf8");

// Parse just enough to inspect the two values that block setup.
function readVar(name) {
  const match = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function upsertVar(name, value) {
  const line = `${name}="${value}"`;
  const pattern = new RegExp(`^\\s*${name}\\s*=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}

/* --- AUTH_SECRET ---------------------------------------------------------- */

const currentSecret = readVar("AUTH_SECRET");
const secretIsUsable =
  currentSecret &&
  currentSecret.length >= 32 &&
  !PLACEHOLDER_SECRETS.includes(currentSecret);

if (!secretIsUsable) {
  upsertVar("AUTH_SECRET", randomBytes(32).toString("base64"));
  writeFileSync(envPath, env);
  ok("Generated a fresh AUTH_SECRET");
  if (currentSecret && PLACEHOLDER_SECRETS.includes(currentSecret)) {
    dim("replaced the placeholder value that shipped in the template");
  }
} else {
  dim("AUTH_SECRET looks good — keeping it");
}

/* --- DATABASE_URL --------------------------------------------------------- */

if (!readVar("DATABASE_URL")) {
  upsertVar("DATABASE_URL", "file:./dev.db");
  writeFileSync(envPath, env);
  ok("Set DATABASE_URL to a local SQLite file (file:./dev.db)");
} else {
  dim(`DATABASE_URL is set (${readVar("DATABASE_URL")})`);
}

/* --- PORT ----------------------------------------------------------------- */

// Written explicitly rather than left to the built-in default, so the .env shows
// which port the app will actually use.
if (!readVar("PORT")) {
  upsertVar("PORT", String(DEFAULT_PORT));
  writeFileSync(envPath, env);
  ok(`Set PORT to ${DEFAULT_PORT}`);
} else {
  dim(`PORT is set (${readVar("PORT")})`);
}

// Prisma reads .env itself, but the seed script runs in this process tree and
// several Prisma subcommands resolve env before loading the file. Export both so
// nothing downstream can trip over a missing value.
process.env.DATABASE_URL = readVar("DATABASE_URL");
process.env.AUTH_SECRET = readVar("AUTH_SECRET");

/* -------------------------------------------------------------------------- */
/* 2. Database                                                                */
/* -------------------------------------------------------------------------- */

console.log("");
run("npx prisma generate", "Generating Prisma client…");
run("npx prisma db push --skip-generate", "Applying the schema…");

/* -------------------------------------------------------------------------- */
/* 3. Seed                                                                    */
/* -------------------------------------------------------------------------- */

const skipSeed = process.argv.includes("--no-seed");

if (skipSeed) {
  console.log("");
  dim("Skipping seed (--no-seed). The first account you register becomes admin.");
} else {
  console.log("");
  run("npx tsx prisma/seed.ts", "Loading the demo dataset…");
}

/* -------------------------------------------------------------------------- */
/* Done                                                                       */
/* -------------------------------------------------------------------------- */

console.log(`\n${c.green}${c.bold}Ready.${c.reset} Start the dev server with:\n`);
console.log(`    ${c.bold}npm run dev${c.reset}\n`);

if (!skipSeed) {
  console.log(
    `Then sign in at ${c.cyan}http://localhost:${DEFAULT_PORT}${c.reset} as:\n`
  );
  console.log("    admin@example.com       (Admin)");
  console.log("    instructor@example.com  (Instructor)");
  console.log("    learner@example.com     (Learner)\n");
  console.log(`  ${c.dim}Password for all seeded accounts: Password123!${c.reset}\n`);
} else {
  console.log(
    `Register at ${c.cyan}http://localhost:${DEFAULT_PORT}/register${c.reset} — the first account becomes an administrator.\n`
  );
}

if (process.env.NODE_ENV === "production") {
  warn("NODE_ENV is 'production'. This script is intended for local setup.");
}
