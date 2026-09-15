/**
 * Works out exactly which packages the start-up CLIs need, and stages them.
 *
 * The runtime image deliberately ships no full node_modules — only the handful
 * of package directories the entrypoint calls directly. That list used to be
 * written out by hand in the Dockerfile, which worked until a dependency of a
 * dependency appeared: Prisma 6.19 gave @prisma/config a tree of its own
 * (effect, c12, chokidar, ...), none of which were copied, and the container
 * crash-looped on `Cannot find module 'effect'` before it could sync the schema.
 *
 * So the closure is computed from the installed tree at build time instead of
 * being maintained by hand. Adding a dependency upstream can no longer break the
 * image without anyone noticing.
 */
const fs = require("node:fs");
const path = require("node:path");

const MODULES = "node_modules";
const OUT = "/cli-modules";

/** Entry points the entrypoint script invokes with `node <path>`. */
const ROOTS = ["prisma", "@prisma/client", "@prisma/config", "tsx", "esbuild"];

function manifest(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(MODULES, name, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

const seen = new Set();
function walk(name) {
  if (seen.has(name)) return;
  const pkg = manifest(name);
  if (!pkg) return;              // optional or already-hoisted-away dependency
  seen.add(name);
  for (const dep of Object.keys(pkg.dependencies ?? {})) walk(dep);
}
ROOTS.forEach(walk);

// The generated client and esbuild's platform binary are directories rather
// than resolvable packages, so they are named explicitly.
const extras = [".prisma", "@esbuild"];

fs.mkdirSync(OUT, { recursive: true });
let copied = 0;
for (const name of [...seen, ...extras]) {
  const from = path.join(MODULES, name);
  if (!fs.existsSync(from)) continue;
  const to = path.join(OUT, name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, dereference: false });
  copied += 1;
}

console.log(`staged ${copied} packages for the runtime image`);
