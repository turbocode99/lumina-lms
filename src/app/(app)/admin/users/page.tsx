import type { Metadata } from "next";

import { UserManager } from "@/components/admin/UserManager";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin("/admin/users");

  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      department: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { enrollments: true, certificates: true } },
    },
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          People
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Add accounts, change roles, and deactivate anyone who has left.
        </p>
      </header>

      <UserManager users={users} />
    </div>
  );
}
