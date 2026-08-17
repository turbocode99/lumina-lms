"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Compass,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Library,
  PenSquare,
  Route,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/enums";
import { ROLE_RANK } from "@/lib/enums";
import { luminaConfig } from "~/lumina.config";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  minRole?: Role;
  enabled?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNav(): NavGroup[] {
  const { features } = luminaConfig;
  return [
    {
      label: "Learn",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
        },
        {
          href: "/catalog",
          label: "Browse catalog",
          icon: <Compass className="h-[18px] w-[18px]" />,
          enabled: features.catalog,
        },
        {
          href: "/my-learning",
          label: "My learning",
          icon: <Library className="h-[18px] w-[18px]" />,
        },
        {
          href: "/paths",
          label: "Learning paths",
          icon: <Route className="h-[18px] w-[18px]" />,
          enabled: features.learningPaths,
        },
        {
          href: "/certificates",
          label: "Certificates",
          icon: <Award className="h-[18px] w-[18px]" />,
          enabled: features.certificates,
        },
      ],
    },
    {
      label: "Teach",
      items: [
        {
          href: "/instructor",
          label: "My courses",
          icon: <PenSquare className="h-[18px] w-[18px]" />,
          minRole: "INSTRUCTOR",
        },
      ],
    },
    {
      label: "Administer",
      items: [
        {
          href: "/admin",
          label: "Overview",
          icon: <BarChart3 className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
        },
        {
          href: "/admin/users",
          label: "People",
          icon: <Users className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
        },
        {
          href: "/admin/roles",
          label: "Roles & access",
          icon: <ShieldCheck className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
        },
        {
          href: "/admin/courses",
          label: "All courses",
          icon: <BookOpen className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
        },
        {
          href: "/admin/paths",
          label: "Paths",
          icon: <Route className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
          enabled: features.learningPaths,
        },
        {
          href: "/admin/categories",
          label: "Categories",
          icon: <FolderTree className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
        },
        {
          href: "/admin/certificates",
          label: "Certificates",
          icon: <Award className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
          enabled: features.certificates,
        },
        {
          href: "/admin/assignments",
          label: "Required training",
          icon: <ClipboardCheck className="h-[18px] w-[18px]" />,
          minRole: "ADMIN",
          enabled: features.mandatoryTraining,
        },
      ],
    },
  ];
}

export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const groups = buildNav();

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.enabled !== false &&
          (!item.minRole || ROLE_RANK[role] >= ROLE_RANK[item.minRole])
      ),
    }))
    .filter((group) => group.items.length > 0);

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/admin" || href === "/instructor") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col transition-transform duration-300 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="m-3 flex flex-1 flex-col overflow-hidden rounded-[var(--radius-neu-lg)] neu-glass lg:neu">
          {/* Brand */}
          <div className="flex items-center justify-between px-5 pb-2 pt-6">
            <Link href="/dashboard" className="flex items-center gap-3">
              <span className="neu-sm flex h-10 w-10 items-center justify-center rounded-2xl text-[var(--accent)]">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                {luminaConfig.brand.name}
              </span>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--text-muted)] lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {visibleGroups.map((group) => (
              <div key={group.label} className="mb-6 last:mb-0">
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-250",
                            active
                              ? "neu-pressed text-[var(--accent)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          <span
                            className={cn(
                              "transition-transform duration-250",
                              active
                                ? "text-[var(--accent)]"
                                : "text-[var(--text-muted)] group-hover:scale-110"
                            )}
                          >
                            {item.icon}
                          </span>
                          {item.label}
                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--border-subtle)] px-5 py-4">
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              {luminaConfig.brand.organization}
              <br />
              <span className="opacity-70">{luminaConfig.brand.tagline}</span>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
