import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  MessageCircle,
  Star,
} from "lucide-react";

import { markNotificationsReadAction } from "@/app/actions/learning";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { cn, formatRelative } from "@/lib/utils";
import { luminaConfig } from "~/lumina.config";
import type { NotificationType } from "@/lib/enums";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const ICONS: Record<NotificationType, { icon: React.ReactNode; color: string }> = {
  ASSIGNMENT: {
    icon: <ClipboardCheck className="h-4 w-4" />,
    color: "var(--accent)",
  },
  DUE_SOON: {
    icon: <CalendarClock className="h-4 w-4" />,
    color: "var(--warning)",
  },
  OVERDUE: {
    icon: <CalendarClock className="h-4 w-4" />,
    color: "var(--danger)",
  },
  ANSWER: { icon: <MessageCircle className="h-4 w-4" />, color: "var(--info)" },
  REVIEW: { icon: <Star className="h-4 w-4" />, color: "var(--warning)" },
  CERTIFICATE: { icon: <Award className="h-4 w-4" />, color: "var(--success)" },
  ENROLLMENT: { icon: <Bell className="h-4 w-4" />, color: "var(--accent)" },
  SYSTEM: { icon: <Bell className="h-4 w-4" />, color: "var(--text-muted)" },
};

export default async function NotificationsPage() {
  if (!luminaConfig.features.notifications) notFound();
  const user = await requireUser("/notifications");

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-[800px]">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Notifications
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            {unread > 0
              ? `${unread} unread`
              : "You're all caught up."}
          </p>
        </div>

        {unread > 0 && (
          <form action={markNotificationsReadAction}>
            <Button type="submit">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          </form>
        )}
      </header>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellOff className="h-9 w-9" />}
            title="Nothing here yet"
            description="Assignments, answers to your questions, and completed certificates will show up here."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notification) => {
            const config =
              ICONS[notification.type as NotificationType] ?? ICONS.SYSTEM;

            const body = (
              <>
                <span
                  className="neu-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ color: config.color }}
                >
                  {config.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-[var(--text-primary)]">
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                    )}
                  </span>
                  {notification.body && (
                    <span className="mt-0.5 block text-sm text-[var(--text-muted)]">
                      {notification.body}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">
                    {formatRelative(notification.createdAt)}
                  </span>
                </span>
              </>
            );

            const className = cn(
              "flex items-start gap-4 rounded-[var(--radius-neu)] p-4",
              notification.read ? "neu-flat" : "neu"
            );

            return notification.link ? (
              <Link
                key={notification.id}
                href={notification.link}
                className={cn(className, "neu-interactive")}
              >
                {body}
              </Link>
            ) : (
              <div key={notification.id} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
