"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { assertUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  checkLoginAllowed,
  clearFailedLogins,
  formatRetryAfter,
  recordFailedLogin,
} from "@/lib/throttle";
import { logActivity, notify } from "@/lib/notify";
import {
  changePasswordSchema,
  fieldErrors,
  loginSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validators";
import type { Role } from "@/lib/enums";

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function allowedDomains(): string[] {
  return (process.env.AUTH_ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  // Throttle before touching the password, so a locked-out attacker gets no
  // timing signal and no further comparisons are performed.
  const throttle = await checkLoginAllowed(parsed.data.email);
  if (throttle.blocked) {
    return {
      errors: {
        _form: `Too many failed sign-in attempts. Try again in ${formatRetryAfter(
          throttle.retryAfterSeconds
        )}.`,
      },
    };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, role: true, isActive: true },
  });

  // Same message for "no such user" and "wrong password" so the form can't be
  // used to enumerate which email addresses have accounts.
  const invalid: ActionState = {
    errors: { _form: "Incorrect email or password." },
  };
  if (!user) {
    // Burn roughly the same time as a real comparison would.
    await verifyPassword(parsed.data.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduu");
    // Recorded even for unknown emails — skipping them would make the throttle
    // itself an account-existence oracle.
    await recordFailedLogin(parsed.data.email);
    return invalid;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(parsed.data.email);
    return invalid;
  }

  if (!user.isActive) {
    return {
      errors: {
        _form: "This account has been deactivated. Contact your administrator.",
      },
    };
  }

  await clearFailedLogins(parsed.data.email);
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id, user.role as Role);

  const next = String(formData.get("next") || "");
  // Only allow same-origin relative paths — an attacker-supplied absolute URL
  // here would turn the login form into an open redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(target);
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (process.env.AUTH_ALLOW_SELF_REGISTRATION === "false") {
    return {
      errors: {
        _form: "Self-registration is disabled. Ask an administrator for an account.",
      },
    };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    department: formData.get("department") ?? "",
    title: formData.get("title") ?? "",
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const domains = allowedDomains();
  if (domains.length) {
    const domain = parsed.data.email.split("@")[1] ?? "";
    if (!domains.includes(domain)) {
      return {
        errors: {
          email: `Registration is limited to: ${domains.join(", ")}`,
        },
      };
    }
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return { errors: { email: "An account with this email already exists." } };
  }

  // First account to register owns the instance — otherwise there is no way to
  // reach the admin console on a fresh deployment.
  const userCount = await db.user.count();
  const role: Role = userCount === 0 ? "ADMIN" : "LEARNER";

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      department: parsed.data.department || null,
      title: parsed.data.title || null,
      role,
      lastLoginAt: new Date(),
    },
    select: { id: true, role: true },
  });

  await createSession(user.id, user.role as Role);
  await notify({
    userId: user.id,
    type: "SYSTEM",
    title: "Welcome aboard",
    body: "Browse the catalog to find your first course.",
    link: "/catalog",
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await assertUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    title: formData.get("title") ?? "",
    department: formData.get("department") ?? "",
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      title: parsed.data.title || null,
      department: parsed.data.department || null,
      headline: parsed.data.headline || null,
      bio: parsed.data.bio || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "profile.update",
    entity: "user",
    entityId: user.id,
  });

  revalidatePath("/profile");
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await assertUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { errors: { _form: "Account not found." } };

  const valid = await verifyPassword(
    parsed.data.currentPassword,
    record.passwordHash
  );
  if (!valid) {
    return { errors: { currentPassword: "That password is incorrect." } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  await logActivity({
    userId: user.id,
    action: "password.change",
    entity: "user",
    entityId: user.id,
  });

  return { ok: true, message: "Password changed." };
}
