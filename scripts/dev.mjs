#!/usr/bin/env node

/**
 * Development server launcher.
 *
 * Wraps `next dev` purely to deal with an occupied port. Observed behaviour when
 * something else already holds the port: Next prints its banner for that port,
 * says "Starting…", and then never becomes ready — it neither moves nor reports
 * an error. Probing first and passing an explicit `--port` avoids that.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "./lib/env.mjs";
import { parsePort, resolvePort } from "./lib/port.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Read PORT (and anything else) from .env before Next starts, since plain Node
// does not load it. Shell values still win.
loadEnvFile(join(root, ".env"));

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

const strict = process.argv.includes("--strict-port");

const requested = parsePort(process.env.PORT);
const { port, moved } = await resolvePort({ preferred: requested, strict });

if (moved) {
  console.log(
    `\n  ${c.yellow}Port ${requested} was already in use, so ${port} was used instead.${c.reset}\n` +
      `  ${c.dim}Pass --strict-port to fail instead of moving.${c.reset}\n` +
      `  ${c.cyan}http://localhost:${port}${c.reset}\n`
  );
}

// Pass any extra flags through, minus the one this script consumes.
const passthrough = process.argv.slice(2).filter((arg) => arg !== "--strict-port");

/**
 * Next's bin is a plain Node script, so it is launched with the current Node
 * binary directly. Going through `npx` would mean spawning `npx.cmd` on Windows,
 * which Node refuses without `shell: true` (EINVAL) — and enabling a shell would
 * put the passthrough arguments through shell parsing for no benefit.
 */
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextBin)) {
  console.error(
    `\n  Could not find Next.js at ${nextBin}\n\n` +
      `  Install dependencies first:\n\n      npm install\n`
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--port", String(port), ...passthrough],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  }
);

// Forward signals so Ctrl-C stops Next rather than orphaning it.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 0));
