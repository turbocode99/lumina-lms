/**
 * Minimal `.env` loader for the launcher scripts.
 *
 * Next.js loads `.env` itself, but only once it is already running — plain Node
 * does not. Without this, a `PORT` set in `.env` would be silently ignored by
 * scripts/dev.mjs and scripts/serve.mjs, which read `process.env.PORT` before
 * Next starts. Since `.env` is where every other setting in this project lives,
 * having one key quietly not work there would be a trap.
 *
 * `process.loadEnvFile()` would do this, but it only landed in Node 20.12 and
 * package.json allows 20.0, so this parses the file directly. It handles the
 * subset of syntax `.env.example` actually uses: `KEY=value`, optional quotes,
 * `#` comments, blank lines.
 */

import { existsSync, readFileSync } from "node:fs";

/**
 * Populates `process.env` from a `.env` file. Values already present win, so an
 * explicit `PORT=5000 npm start` still beats whatever the file says.
 */
export function loadEnvFile(path) {
  if (!existsSync(path)) return;

  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    // An unreadable .env should not stop the server from starting — every value
    // in it has a documented default.
    return;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || Object.hasOwn(process.env, key)) continue;

    let value = line.slice(separator + 1).trim();

    // Strip one matching pair of surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
