"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
} from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TourButton } from "@/components/tour/TourButton";
import { RoleBadge } from "@/components/ui/Badge";
import { cn, formatRelative } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

export interface TopbarNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
}

export function Topbar({
  user,
  notifications,
  unreadCount,
  onMenuClick,
}: {
  user: SessionUser;
  notifications: TopbarNotification[];
  unreadCount: number;
  onMenuClick: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // One listener closes whichever popover the click landed outside of.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(target)) setBellOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : "/catalog");
  };

  return (
    <header className="sticky top-0 z-30 px-3 pt-3">
      <div className="neu-glass flex h-16 items-center gap-3 rounded-[var(--radius-neu)] px-4">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="neu-interactive flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <form onSubmit={submitSearch} className="min-w-0 flex-1 max-w-xl">
          <div className="neu-inset neu-input flex items-center gap-2.5 rounded-2xl px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses, topics, instructors…"
              aria-label="Search courses"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <TourButton />
          <ThemeToggle compact />

          {/* Notifications */}
          <div ref={bellRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setBellOpen((v) => !v);
                setMenuOpen(false);
              }}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={bellOpen}
              className="neu-interactive relative flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)]"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="neu-lg absolute right-0 top-[calc(100%+10px)] w-[340px] animate-scale-in overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Notifications
                  </p>
                  <Link
                    href="/notifications"
                    onClick={() => setBellOpen(false)}
                    className="text-xs font-medium text-[var(--accent)] hover:underline"
                  >
                    See all
                  </Link>
                </div>

                <div className="max-h-[380px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                      Nothing new right now.
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <Link
                        key={item.id}
                        href={item.link ?? "/notifications"}
                        onClick={() => setBellOpen(false)}
                        className={cn(
                          "block border-b border-[var(--border-subtle)] px-4 py-3 transition-colors last:border-0 hover:bg-[var(--surface-raised)]",
                          !item.read && "bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {!item.read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                          )}
                          <div className={cn("min-w-0", item.read && "pl-[18px]")}>
                            <p className="text-sm font-medium leading-snug text-[var(--text-primary)]">
                              {item.title}
                            </p>
                            {item.body && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted)]">
                                {item.body}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                              {formatRelative(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((v) => !v);
                setBellOpen(false);
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="neu-interactive flex items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-2.5"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-[var(--text-primary)] sm:block">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200",
                  menuOpen && "rotate-180"
                )}
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="neu-lg absolute right-0 top-[calc(100%+10px)] w-64 animate-scale-in overflow-hidden rounded-2xl"
              >
                <div className="border-b border-[var(--border-subtle)] p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} src={user.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <RoleBadge role={user.role} />
                  </div>
                </div>

                <div className="p-1.5">
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    href="/profile#security"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                  >
                    <Settings className="h-4 w-4" />
                    Account settings
                  </Link>

                  <form action={logoutAction}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
