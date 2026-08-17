import { AppShell } from "@/components/shell/AppShell";
import { TourProvider } from "@/components/tour/TourProvider";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { luminaConfig } from "~/lumina.config";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // The bell shows a preview; /notifications has the full history.
  const [notifications, unreadCount] = luminaConfig.features.notifications
    ? await Promise.all([
        db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            body: true,
            link: true,
            read: true,
            createdAt: true,
          },
        }),
        db.notification.count({ where: { userId: user.id, read: false } }),
      ])
    : [[], 0];

  // Loaded once here rather than per page, so navigating between screens never
  // waits on a query to decide whether a tour has already been seen.
  const seenTours = await db.tourCompletion.findMany({
    where: { userId: user.id },
    select: { tourId: true },
  });

  return (
    <TourProvider
      role={user.role}
      seenTourIds={seenTours.map((t) => t.tourId)}
      autoStart
    >
      <AppShell
        user={user}
        notifications={notifications}
        unreadCount={unreadCount}
      >
        {children}
      </AppShell>
    </TourProvider>
  );
}
