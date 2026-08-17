#!/usr/bin/env node

/**
 * Change an administrator's sign-in credentials from the command line.
 *
 * Exists for the case every self-hosted install eventually hits: the admin email
 * is wrong, or nobody can sign in, and there is no way to fix it from inside a UI
 * that requires signing in first. Running this needs shell access to the server,
 * which is a higher bar than the app itself enforces, so it is allowed to do
 * things the UI will not.
 *
 * Usage:
 *   node scripts/set-admin.mjs --email new@example.com --password 'secret'
 *   node scripts/set-admin.mjs --from old@example.com --email new@example.com
 *   node scripts/set-admin.mjs --email a@b.com --password x --name 'Full Name'
 *
 * With no --from, it targets the only administrator; if there are several it asks
 * you to name one, rather than guessing which account to rewrite.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { loadEnvFile } from "./lib/env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(join(root, ".env"));

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
};

/* --- Arguments ------------------------------------------------------------- */

function readFlag(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  // Guard against `--email --password x` swallowing the next flag as a value.
  if (!value || value.startsWith("--")) {
    fail(`--${name} needs a value.`);
  }
  return value;
}

function fail(message, hint) {
  console.error(`\n${c.red}${c.bold}${message}${c.reset}`);
  if (hint) console.error(`\n${hint}`);
  console.error("");
  process.exit(1);
}

const newEmail = readFlag("email");
const newPassword = readFlag("password");
const newName = readFlag("name");
const fromEmail = readFlag("from");

if (!newEmail && !newPassword && !newName) {
  fail(
    "Nothing to change.",
    `Usage:\n\n` +
      `    ${c.bold}node scripts/set-admin.mjs --email new@example.com --password 'secret'${c.reset}\n\n` +
      `Optional: --from <current email>, --name <full name>`
  );
}

if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
  fail(`"${newEmail}" does not look like an email address.`);
}

const db = new PrismaClient();

async function main() {
  /* --- Locate the account ------------------------------------------------- */

  let target;

  if (fromEmail) {
    target = await db.user.findUnique({
      where: { email: fromEmail.toLowerCase() },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!target) fail(`No account found with email ${fromEmail}.`);
  } else {
    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    if (admins.length === 0) {
      fail(
        "There are no administrator accounts.",
        `Name any account to promote and update:\n\n` +
          `    ${c.bold}node scripts/set-admin.mjs --from someone@example.com --email new@example.com${c.reset}`
      );
    }

    if (admins.length > 1) {
      fail(
        `There are ${admins.length} administrators, so it is ambiguous which to change.`,
        `Name one with --from:\n\n` +
          admins.map((a) => `    ${a.email}`).join("\n")
      );
    }

    target = admins[0];
  }

  /* --- Check the new email is free ---------------------------------------- */

  if (newEmail) {
    const clash = await db.user.findFirst({
      where: { email: newEmail.toLowerCase(), NOT: { id: target.id } },
      select: { email: true },
    });
    if (clash) fail(`${clash.email} is already used by another account.`);
  }

  /* --- Apply -------------------------------------------------------------- */

  const data = {
    // Always ensure the account can actually sign in and administer.
    role: "ADMIN",
    isActive: true,
  };

  if (newEmail) data.email = newEmail.toLowerCase();
  if (newName) data.name = newName;
  if (newPassword) data.passwordHash = await bcrypt.hash(newPassword, 12);

  await db.user.update({ where: { id: target.id }, data });

  /* --- Report ------------------------------------------------------------- */

  console.log(`\n${c.green}${c.bold}Administrator updated.${c.reset}\n`);
  console.log(`  ${c.dim}was${c.reset}   ${target.email}`);
  console.log(`  ${c.dim}now${c.reset}   ${c.cyan}${data.email ?? target.email}${c.reset}`);
  if (newName) console.log(`  ${c.dim}name${c.reset}  ${newName}`);
  // The password itself is never echoed — it would land in shell history and CI
  // logs. Whoever ran the command already knows it.
  if (newPassword) console.log(`  ${c.dim}password${c.reset} changed`);
  if (target.role !== "ADMIN") {
    console.log(`  ${c.dim}role${c.reset}  promoted to ADMIN`);
  }
  console.log("");

  if (newPassword && newPassword.length < 8) {
    console.log(
      `${c.yellow}Note:${c.reset} that password is ${newPassword.length} characters. The app requires 8+\n` +
        `for self-registration and for the change-password form, so it can be set\n` +
        `here but not re-entered through the UI. Fine locally; worth changing before\n` +
        `this instance is reachable by anyone else.\n`
    );
  }

  console.log(
    `${c.dim}Existing sessions keep working — they are signed with AUTH_SECRET, not the\n` +
      `password. Sign out and back in to use the new credentials.${c.reset}\n`
  );
}

main()
  .catch((error) => {
    console.error(`\n${c.red}${c.bold}Failed.${c.reset} ${error.message}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
