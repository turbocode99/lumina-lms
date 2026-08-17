#!/usr/bin/env node

/**
 * End-to-end smoke test against a running server.
 *
 *   npm start          # in one terminal
 *   npm run smoke      # in another
 *
 * Walks every route as each role, checks that the role guards actually redirect,
 * that lesson media streams with range support and stays behind the auth gate,
 * and that the dashboard and admin tiles carry real hrefs. The last part exists
 * because those tiles were once styled as interactive while linking nowhere — the
 * kind of regression a type checker cannot see.
 *
 * Sessions are minted by signing the same HS256 cookie the app issues, so no
 * browser is needed. It reads AUTH_SECRET from .env, so it is a local dev tool.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

import { loadEnvFile } from "./lib/env.mjs";
import { DEFAULT_PORT } from "./lib/port.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(join(root, ".env"));

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
};

const flagIndex = process.argv.indexOf("--base");
const BASE =
  flagIndex !== -1 && process.argv[flagIndex + 1]
    ? process.argv[flagIndex + 1].replace(/\/$/, "")
    : `http://127.0.0.1:${process.env.PORT || DEFAULT_PORT}`;

if (!process.env.AUTH_SECRET) {
  console.error(
    `\n${c.red}AUTH_SECRET is not set.${c.reset} Run \`npm run setup\` first.\n`
  );
  process.exit(1);
}

const db = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const results = [];

async function sessionFor(where) {
  const user = await db.user.findFirst({
    where,
    select: { id: true, role: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) return null;
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
  return { cookie: `lumina_session=${token}`, user };
}

async function route(label, path, cookie, expect = 200) {
  try {
    const res = await fetch(BASE + path, {
      headers: cookie ? { cookie } : {},
      redirect: "manual",
    });
    const ok = Array.isArray(expect)
      ? expect.includes(res.status)
      : res.status === expect;
    results.push({ label, detail: String(res.status), ok, path });
    return res.headers.get("content-type")?.includes("text/html")
      ? await res.text()
      : "";
  } catch (error) {
    results.push({ label, detail: `ERR ${error.message}`, ok: false, path });
    return "";
  }
}

function assert(label, condition, detail = "") {
  results.push({ label, detail: detail || (condition ? "yes" : "no"), ok: Boolean(condition) });
}

/* --- fixtures -------------------------------------------------------------- */

const admin = await sessionFor({ role: "ADMIN" });
const instructor = await sessionFor({ role: "INSTRUCTOR" });
const learner = await sessionFor({ role: "LEARNER" });

if (!admin) {
  console.error(`\n${c.red}No administrator in the database.${c.reset} Seed it first.\n`);
  process.exit(1);
}

const course = await db.course.findFirst({
  where: { status: "PUBLISHED" },
  select: { id: true, slug: true },
});
const videoLesson = await db.lesson.findFirst({
  where: { type: "VIDEO", contentUrl: { not: null } },
  select: { id: true, contentUrl: true, section: { select: { course: { select: { slug: true } } } } },
});
const quizLesson = await db.lesson.findFirst({
  where: { type: "QUIZ" },
  select: { id: true, section: { select: { course: { select: { slug: true } } } } },
});
const resource = await db.lesson.findFirst({
  where: { type: "RESOURCE", contentUrl: { not: null } },
  select: { contentUrl: true },
});
const learningPath = await db.learningPath.findFirst({ select: { slug: true } });
const certificate = await db.certificate.findFirst({ select: { id: true } });
const thumb = await db.course.findFirst({
  where: { thumbnailUrl: { not: null } },
  select: { thumbnailUrl: true },
});

console.log(`\n${c.bold}Smoke test${c.reset} ${c.dim}${BASE}${c.reset}\n`);

/* --- routes ---------------------------------------------------------------- */

const dashboard = await route("dashboard", "/dashboard", learner?.cookie ?? admin.cookie);
await route("catalog", "/catalog", admin.cookie);
await route("catalog filtered", "/catalog?q=security&sort=rating&level=Intermediate", admin.cookie);
if (course) await route("course detail", `/courses/${course.slug}`, admin.cookie);
const myLearning = await route("my-learning ?tab", "/my-learning?tab=completed", learner?.cookie ?? admin.cookie);
await route("paths", "/paths", admin.cookie);
if (learningPath) await route("path detail", `/paths/${learningPath.slug}`, admin.cookie);
await route("certificates", "/certificates", admin.cookie);
if (certificate) await route("certificate", `/certificates/${certificate.id}`, admin.cookie);
await route("notifications", "/notifications", admin.cookie);
await route("profile", "/profile", admin.cookie);

const player = videoLesson
  ? await route("video lesson", `/learn/${videoLesson.section.course.slug}/${videoLesson.id}`, admin.cookie)
  : "";
if (quizLesson) {
  await route("quiz lesson", `/learn/${quizLesson.section.course.slug}/${quizLesson.id}`, admin.cookie);
}

await route("instructor home", "/instructor", instructor?.cookie ?? admin.cookie);
const newCourse = await route("new course form", "/instructor/courses/new", instructor?.cookie ?? admin.cookie);
if (course) await route("course builder", `/instructor/courses/${course.id}`, admin.cookie);

const adminHome = await route("admin overview", "/admin", admin.cookie);
await route("admin users", "/admin/users", admin.cookie);
await route("admin users ?role", "/admin/users?role=INSTRUCTOR", admin.cookie);
await route("admin courses", "/admin/courses", admin.cookie);
await route("admin paths", "/admin/paths", admin.cookie);
await route("admin categories", "/admin/categories", admin.cookie);
await route("admin certificates", "/admin/certificates", admin.cookie);
await route("admin assignments ?status", "/admin/assignments?status=overdue", admin.cookie);

/* --- guards ---------------------------------------------------------------- */

if (learner) {
  await route("admin blocked for learner", "/admin", learner.cookie, [302, 307]);
  await route("instructor blocked for learner", "/instructor", learner.cookie, [302, 307]);
}
await route("anonymous redirected", "/dashboard", null, [302, 307]);
await route("health is public", "/api/health", null);

/* --- media ----------------------------------------------------------------- */

async function media(label, url, expectType) {
  const res = await fetch(BASE + url, { headers: { cookie: admin.cookie } });
  const type = res.headers.get("content-type") ?? "";
  const bytes = Number(res.headers.get("content-length") ?? 0);
  results.push({
    label,
    detail: `${res.status} ${type.split(";")[0]} ${(bytes / 1024).toFixed(0)}KB`,
    ok: res.status === 200 && type.includes(expectType) && bytes > 1000,
  });
}

if (videoLesson) await media("lesson video streams", videoLesson.contentUrl, "video/mp4");
if (thumb) await media("thumbnail serves", thumb.thumbnailUrl, "image/jpeg");
if (resource) await media("resource pdf serves", resource.contentUrl, "application/pdf");

if (videoLesson) {
  const ranged = await fetch(BASE + videoLesson.contentUrl, {
    headers: { cookie: admin.cookie, range: "bytes=500-1499" },
  });
  assert(
    "video supports range requests",
    ranged.status === 206 && Boolean(ranged.headers.get("content-range")),
    `${ranged.status} ${ranged.headers.get("content-range") ?? ""}`
  );

  const anon = await fetch(BASE + videoLesson.contentUrl, { redirect: "manual" });
  assert("video requires a session", anon.status === 401, String(anon.status));
}

/* --- tiles actually link --------------------------------------------------- */

assert(
  "dashboard tiles link to records",
  ["/my-learning", "/my-learning?tab=in-progress", "/my-learning?tab=completed", "/certificates"].every(
    (href) => dashboard.includes(`href="${href}"`)
  )
);
assert(
  "admin tiles link to records",
  ["/admin/users", "/admin/courses", "/admin/certificates"].every((href) =>
    adminHome.includes(`href="${href}"`)
  )
);
assert(
  "compliance tiles link to filters",
  adminHome.includes("/admin/assignments?status=open") &&
    adminHome.includes("/admin/assignments?status=overdue")
);
assert("my-learning honours ?tab", myLearning.includes("Completed"));
if (videoLesson) assert("player embeds the video", player.includes(videoLesson.contentUrl));
assert("create form offers a thumbnail", newCourse.includes('name="thumbnailUrl"'));

/* --- report ---------------------------------------------------------------- */

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  const mark = r.ok ? `${c.green}PASS${c.reset}` : `${c.red}FAIL${c.reset}`;
  console.log(
    `  ${mark}  ${r.label.padEnd(34)} ${c.dim}${r.detail.padEnd(28)}${r.path ?? ""}${c.reset}`
  );
}

console.log(
  failed
    ? `\n${c.red}${c.bold}${failed} of ${results.length} checks failed.${c.reset}\n`
    : `\n${c.green}${c.bold}All ${results.length} checks passed.${c.reset}\n`
);

await db.$disconnect();
process.exit(failed ? 1 : 0);
