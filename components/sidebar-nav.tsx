"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wallet,
  CalendarClock,
  CalendarDays,
  Tag,
  ClipboardCheck,
  Trash2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: string;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { href: "/borrowers", label: "Borrowers", Icon: Users },
      { href: "/accounts", label: "Accounts", Icon: Wallet },
      {
        href: "/due-this-month",
        label: "Due this month",
        Icon: CalendarClock,
        badge: "456",
      },
    ],
  },
  {
    heading: "Manage",
    items: [
      { href: "/calendar", label: "Calendar", Icon: CalendarDays },
      { href: "/categories", label: "Categories", Icon: Tag },
      { href: "/daily-checklist", label: "Checklist", Icon: ClipboardCheck },
    ],
  },
  {
    heading: "System",
    items: [
      { href: "/deleted", label: "Trash", Icon: Trash2 },
      { href: "/settings", label: "Settings", Icon: Settings },
    ],
  },
];

const STORAGE_KEY = "sidebar-collapsed";

export default function SidebarNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setCollapsed(saved === "true");
    } else if (typeof window !== "undefined") {
      setCollapsed(!window.matchMedia("(min-width: 1024px)").matches);
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? "4.5rem" : "16rem",
    );
  }, [collapsed]);

  return (
    <aside
      data-collapsed={collapsed}
      className="group/sidebar lowercase fixed inset-y-0 left-0 z-40 hidden
        flex-col border-r border-sidebar-border bg-sidebar transition-[width]
        duration-300 ease-in-out md:flex print:hidden"
      style={{ width: collapsed ? "4.5rem" : "16rem" }}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-4">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl
            bg-primary text-primary-foreground shadow-sm"
        >
          <TrendingUp className="size-5" strokeWidth={2.5} aria-hidden="true" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p
              className="text-base font-black leading-none tracking-tight
                text-sidebar-foreground"
            >
              *utangz
            </p>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Primary">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.heading} className={gi === 0 ? "" : "mt-6"}>
            {!collapsed ? (
              <p
                className="px-2.5 pb-2 text-[10px] font-bold uppercase
                  tracking-widest text-muted-foreground/70"
              >
                {group.heading}
              </p>
            ) : (
              gi !== 0 && (
                <div
                  className="mx-2 mb-3 border-t border-sidebar-border"
                  aria-hidden="true"
                />
              )
            )}
            <ul className="flex flex-col gap-1">
              {group.items.map(({ href, label, Icon, badge }) => {
                const isActive = mounted && isActivePath(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={`group/item relative flex w-full items-center
                      gap-3 rounded-xl px-2.5 py-2.5 text-sm font-bold
                      tracking-tight transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : `text-sidebar-foreground/70 hover:bg-sidebar-accent
                            hover:text-sidebar-foreground`
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon
                        className="size-5 shrink-0"
                        strokeWidth={isActive ? 2.5 : 2}
                        aria-hidden="true"
                      />
                      {!collapsed && <span className="truncate">{label}</span>}
                      {!collapsed && badge && (
                        <span
                          className={`ml-auto rounded-full px-2 py-0.5
                          text-[10px] font-bold tabular-nums ${
                            isActive
                              ? `bg-primary-foreground/20
                                text-primary-foreground`
                              : "bg-accent/20 text-accent-foreground"
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                      {collapsed && badge && (
                        <span
                          className="absolute right-1.5 top-1.5 size-2
                            rounded-full bg-accent"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: user + collapse */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={`flex items-center gap-3 rounded-xl px-1.5 py-1.5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center
              rounded-full bg-primary/15 text-sm font-bold text-primary"
          >
            JD
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold leading-none
                  text-sidebar-foreground"
              >
                Juan Dela Cruz
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                Collector
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mt-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-2
            text-xs font-black text-muted-foreground transition-colors
            hover:bg-sidebar-accent hover:text-sidebar-foreground ${
              collapsed ? "justify-center" : ""
            }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="size-4" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
