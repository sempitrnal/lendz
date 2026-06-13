"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useTransition } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  CalendarDays,
  Tag,
  ClipboardCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "dashboard", Icon: LayoutDashboard },
  { href: "/borrowers", label: "borrowers", Icon: Users },
  { href: "/accounts", label: "accounts", Icon: Wallet },
  { href: "/calendar", label: "calendar", Icon: CalendarDays },
  { href: "/categories", label: "categories", Icon: Tag },
  { href: "/daily-checklist", label: "checklist", Icon: ClipboardCheck },
  { href: "/deleted", label: "trash", Icon: Trash2 },
];

const STORAGE_KEY = "sidebar-collapsed";

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setCollapsed(saved === "true");
    } else {
      // Default: collapsed on tablet (md), expanded on desktop (lg+)
      const mql = window.matchMedia("(min-width: 1024px)");
      setCollapsed(!mql.matches);
    }
    NAV_ITEMS.forEach(({ href }) => router.prefetch(href));
  }, [router]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const widthVar = collapsed ? "3.5rem" : "14rem";

  return (
    <>
      {/* CSS variable injector so layout can read sidebar width */}
      <style>{`:root { --sidebar-width: ${widthVar}; }`}</style>

      <aside
        className="bg-background dark:bg-background border-r border-slate-200
          dark:border-border/50 fixed top-0 left-0 z-40 hidden h-screen flex-col
          transition-all duration-300 ease-in-out md:flex"
        style={{ width: widthVar }}
      >
        {/* Logo area */}
        <div
          className="flex h-16 items-center border-b border-slate-200
            dark:border-border/50 px-3"
        >
          <button
            type="button"
            onClick={() => {
              setPendingHref("/");
              startTransition(() => router.push("/"));
            }}
            className="dark:text-foreground text-lg font-black tracking-tight
              transition-colors hover:text-stone-600 truncate"
            title="*utangz"
          >
            {collapsed ? "*U" : "*utangz"}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive =
                mounted &&
                (pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href)));
              const isLoading = isPending && pendingHref === href;

              return (
                <li key={href}>
                  <button
                    type="button"
                    onPointerEnter={() => router.prefetch(href)}
                    onClick={() => {
                      setPendingHref(href);
                      startTransition(() => router.push(href));
                    }}
                    className={`relative flex w-full items-center gap-3
                    rounded-lg px-2.5 py-2.5 text-sm font-semibold tracking-wide
                    uppercase transition-colors ${
                      isActive
                        ? "bg-green-300 text-slate-900 dark:bg-green-400"
                        : `text-slate-500 hover:bg-slate-100
                          dark:text-muted-foreground dark:hover:bg-muted`
                    } ${isLoading ? "opacity-60" : ""}
                    ${collapsed ? "justify-center" : ""}`}
                    title={collapsed ? label : undefined}
                  >
                    {isActive && !collapsed && (
                      <span
                        className="absolute inset-y-1.5 left-0 w-[3px] rounded-r
                          bg-slate-900 dark:bg-slate-100"
                      />
                    )}
                    {isLoading ? (
                      <Loader2 className="size-5 animate-spin shrink-0" />
                    ) : (
                      <Icon
                        className="size-5 shrink-0"
                        strokeWidth={isActive ? 2.5 : 1.75}
                      />
                    )}
                    {!collapsed && <span className="truncate">{label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Toggle */}
        <div
          className="border-t border-slate-200 dark:border-border/50 px-2 py-2"
        >
          <button
            type="button"
            onClick={toggle}
            className="dark:text-muted-foreground flex w-full items-center
              justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold
              text-slate-500 transition-colors hover:bg-slate-100
              dark:hover:bg-muted"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4" />
                <span className="truncate">collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
