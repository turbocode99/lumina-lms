"use client";

import { useState } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarNotification } from "./Topbar";
import type { SessionUser } from "@/lib/auth";

/**
 * Owns the one piece of shell state that has to live on the client: whether the
 * mobile drawer is open. Everything else — the user, the notification list — is
 * fetched on the server and passed down.
 */
export function AppShell({
  user,
  notifications,
  unreadCount,
  children,
}: {
  user: SessionUser;
  notifications: TopbarNotification[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar
        role={user.role}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="lg:pl-[268px]">
        <Topbar
          user={user}
          notifications={notifications}
          unreadCount={unreadCount}
          onMenuClick={() => setNavOpen(true)}
        />
        <main id="main" className="px-3 pb-16 pt-5 sm:px-5 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
