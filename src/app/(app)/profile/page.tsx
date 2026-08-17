import type { Metadata } from "next";
import { Award, BookOpen, GraduationCap, KeyRound, UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badge";
import { Card, CardTitle, StatCard } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TourSettings } from "@/components/tour/TourSettings";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

import { PasswordForm, ProfileForm } from "./ProfileForms";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/profile");

  const [enrollmentCount, completedCount, certificateCount, record] =
    await Promise.all([
      db.enrollment.count({ where: { userId: user.id } }),
      db.enrollment.count({
        where: { userId: user.id, completedAt: { not: null } },
      }),
      db.certificate.count({ where: { userId: user.id } }),
      db.user.findUnique({
        where: { id: user.id },
        select: { createdAt: true, lastLoginAt: true },
      }),
    ]);

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      {/* Identity */}
      <Card elevation="lg">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Avatar name={user.name} src={user.avatarUrl} size="2xl" ring />

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {user.name}
              </h1>
              <RoleBadge role={user.role} />
            </div>

            <p className="mt-1 text-[var(--text-muted)]">{user.email}</p>

            {(user.title || user.department) && (
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                {[user.title, user.department].filter(Boolean).join(" · ")}
              </p>
            )}

            {user.headline && (
              <p className="mt-3 text-sm text-[var(--accent)]">{user.headline}</p>
            )}

            {user.bio && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                {user.bio}
              </p>
            )}

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Member since {formatDate(record?.createdAt)}
              {record?.lastLoginAt &&
                ` · Last signed in ${formatDate(record.lastLoginAt)}`}
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Enrolled"
          value={enrollmentCount}
          icon={<BookOpen className="h-5 w-5" />}
          href="/my-learning"
          hint="View all courses"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          icon={<GraduationCap className="h-5 w-5" />}
          accent="var(--success)"
          href="/my-learning?tab=completed"
          hint="View completed"
        />
        <StatCard
          label="Certificates"
          value={certificateCount}
          icon={<Award className="h-5 w-5" />}
          accent="var(--warning)"
          href="/certificates"
          hint="View certificates"
        />
      </div>

      {/* Details */}
      <Card>
        <CardTitle className="mb-5 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-[var(--accent)]" />
          Profile details
        </CardTitle>
        <ProfileForm user={user} />
      </Card>

      {/* Guided tours */}
      <TourSettings user={user} />

      {/* Appearance */}
      <Card>
        <CardTitle className="mb-2">Appearance</CardTitle>
        <p className="mb-5 text-sm text-[var(--text-muted)]">
          Choose a colour theme. &quot;System&quot; follows your operating system
          setting.
        </p>
        <ThemeToggle />
      </Card>

      {/* Security */}
      <Card id="security">
        <CardTitle className="mb-5 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[var(--accent)]" />
          Password
        </CardTitle>
        <PasswordForm />
      </Card>
    </div>
  );
}
