/**
 * Full shot list in light mode — pages and interaction states in one pass.
 * Writes retina PNGs for the edit and JPEGs for the web player.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

// Paths resolve from this file, so the pipeline runs from any clone.
const HERE = dirname(fileURLToPath(import.meta.url));
const MARKETING = join(HERE, "..");
const WORK = join(tmpdir(), "lumina-film");


const APP = "http://localhost:4400";
const PNG = join(MARKETING, "shots");
const WEB = join(MARKETING, "shots-web");
const PASS = "Password123!";

const COURSE = "secure-coding-fundamentals";
const VIDEO_LESSON = "cmty910c8001ll3kcex4tj0nn";
const QUIZ_LESSON = "cmty910d6001vl3kc7pvq3ml5";
const PATH = "new-engineer-onboarding";
const CERT = "cmty910sn006nl3kca3px4x2u";

mkdirSync(PNG, { recursive: true });
mkdirSync(WEB, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(900);
  try {
    await page.screenshot({ path: `${PNG}/${name}.png` });
    await page.screenshot({ path: `${WEB}/${name}.jpg`, type: "jpeg", quality: 84 });
    console.log("  ✓", name);
  } catch (e) {
    console.log("  –", name, String(e).slice(0, 70));
  }
}

async function visit(page, path) {
  for (let a = 1; a <= 3; a += 1) {
    try {
      await page.goto(APP + path, { waitUntil: "domcontentloaded", timeout: 60000 });
      break;
    } catch (e) {
      if (a === 3) { console.log("  – nav failed", path); return false; }
      await page.waitForTimeout(1800);
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1600);
  return true;
}

async function signIn(page, email) {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL(/dashboard/, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

function ctxOpts() {
  return {
    viewport: { width: 1280, height: 720 },
    colorScheme: "light",     // the producer's note: everything in light
    deviceScaleFactor: 2,
  };
}

const browser = await chromium.launch();

// --- Signed out ----------------------------------------------------------
{
  const ctx = await browser.newContext(ctxOpts());
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await shot(page, "03-signin-light");
  await shot(page, "03b-signin-dark");   // same frame; kept so scene 24 still resolves
  await ctx.close();
}

// --- Learner -------------------------------------------------------------
{
  const ctx = await browser.newContext(ctxOpts());
  const page = await ctx.newPage();
  console.log("learner:");
  await signIn(page, "learner@example.com");

  const pages = [
    ["04-dashboard", "/dashboard"],
    ["05-catalog", "/catalog"],
    ["05b-catalog-filtered", "/catalog?q=security&level=Beginner"],
    ["06-course-page", `/courses/${COURSE}`],
    ["07-player", `/learn/${COURSE}/${VIDEO_LESSON}`],
    ["08b-my-learning", "/my-learning"],
    ["09-paths", "/paths"],
    ["09b-path-detail", `/paths/${PATH}`],
    ["10-certificates", "/certificates"],
    ["10b-certificate", `/certificates/${CERT}`],
    ["11-leaderboard", "/leaderboard"],
    ["11b-notifications", "/notifications"],
  ];
  for (const [name, path] of pages) { if (await visit(page, path)) await shot(page, name); }

  // Notes beside the player.
  if (await visit(page, `/learn/${COURSE}/${VIDEO_LESSON}`)) {
    try {
      const tab = page.getByRole("button", { name: /notes/i }).first();
      if (await tab.count()) {
        await tab.click();
        await page.waitForTimeout(700);
        const box = page.locator("textarea").first();
        if (await box.count()) await box.fill("Input validation belongs at the boundary — check the ORM notes before the exercise.");
        await page.waitForTimeout(500);
      }
      await shot(page, "L1-notes");
    } catch { console.log("  – notes not reachable"); }
  }

  // Q&A sits on the course page.
  if (await visit(page, `/courses/${COURSE}`)) {
    try {
      const qa = page.getByText(/questions|Q&A/i).first();
      if (await qa.count()) { await qa.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(800); }
    } catch {}
    await shot(page, "L2-qa");
  }

  // Quiz: options are buttons; one per question enables Submit.
  if (await visit(page, `/learn/${COURSE}/${QUIZ_LESSON}`)) {
    const picked = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll("div")).filter(
        (d) => typeof d.className === "string" && d.className.includes("space-y-2.5")
      );
      let n = 0;
      for (const g of groups) { const b = g.querySelector("button:not([disabled])"); if (b) { b.click(); n += 1; } }
      return n;
    });
    console.log("    answered", picked, "questions");
    await page.waitForTimeout(700);
    await shot(page, "L3-quiz-answering");

    const submit = page.getByRole("button", { name: /submit answers/i }).first();
    if (await submit.isEnabled().catch(() => false)) {
      await submit.click();
      await page.waitForTimeout(2600);
      await shot(page, "L4-quiz-graded");
    } else console.log("  – submit disabled, graded state skipped");
  }

  await ctx.close();
}

// --- Instructor and administration ---------------------------------------
{
  const ctx = await browser.newContext(ctxOpts());
  const page = await ctx.newPage();
  console.log("admin:");
  await signIn(page, "admin@example.com");

  const pages = [
    ["12-instructor", "/instructor"],
    ["13-admin-overview", "/admin"],
    ["13b-admin-people", "/admin/users"],
    ["13c-admin-roles", "/admin/roles"],
    ["14-required-training", "/admin/assignments"],
    ["14b-required-overdue", "/admin/assignments?status=overdue"],
    ["15-admin-certificates", "/admin/certificates"],
    ["15b-admin-courses", "/admin/courses"],
  ];
  for (const [name, path] of pages) { if (await visit(page, path)) await shot(page, name); }

  // Builder, resolved from the admin course list.
  if (await visit(page, "/admin/courses")) {
    const href = await page.locator('a[href*="/instructor/courses/"]').first()
      .getAttribute("href").catch(() => null);
    if (href && await visit(page, href)) await shot(page, "12b-course-builder");
    else console.log("  – builder link not found");
  }

  // Assignment form mid-fill, then filtered by department.
  if (await visit(page, "/admin/assignments")) {
    try { await page.selectOption("select", { label: "Workplace Conduct & Compliance" }); } catch {}
    try { await page.fill('input[type="date"]', "2026-10-15"); } catch {}
    try { await page.fill("textarea", "Annual refresher. Please complete before the audit window opens."); } catch {}
    await page.evaluate(() => window.scrollTo({ top: 380, behavior: "instant" }));
    await shot(page, "A1-assign-filled");

    try {
      const selects = page.locator("select");
      const c = await selects.count();
      if (c > 1) await selects.nth(c - 1).selectOption({ label: "Engineering" });
      await page.waitForTimeout(800);
      await shot(page, "A2-assign-by-department");
    } catch { console.log("  – department filter not found"); }
  }

  await ctx.close();
}

await browser.close();
console.log("done — light mode");
