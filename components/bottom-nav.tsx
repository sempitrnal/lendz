"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Tag,
  ClipboardCheck,
  CalendarDays,
  Trash2,
  CalendarClock,
  Menu,
  X,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "dashboard", Icon: LayoutDashboard },
  { href: "/daily-checklist", label: "checklist", Icon: ClipboardCheck },

  { href: "/borrowers", label: "borrowers", Icon: Users },
  { href: "/due-this-month", label: "due", Icon: CalendarClock },
];

const ALL_ITEMS: NavItem[] = [
  ...PRIMARY_ITEMS.slice(0, 3),
  { href: "/due-this-month", label: "due this month", Icon: CalendarClock },
  { href: "/calendar", label: "calendar", Icon: CalendarDays },
  { href: "/categories", label: "categories", Icon: Tag },
  { href: "/deleted", label: "trash", Icon: Trash2 },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Floating bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-2
          md:hidden print:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div
          className="flex w-full max-w-md items-center gap-1 rounded-2xl border
            border-border/70 bg-card/80 p-1.5 shadow-lg shadow-black/20
            backdrop-blur-xl supports-[backdrop-filter]:bg-card/60"
        >
          {PRIMARY_ITEMS.map(({ href, label, Icon }) => {
            const isActive = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex flex-1 flex-col items-center
                justify-center gap-1 rounded-xl py-2 transition-all duration-200
                ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : `text-muted-foreground hover:text-foreground
                      active:bg-muted`
                }`}
              >
                <Icon
                  className="size-5"
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-bold leading-none
                  tracking-tight">
                  {label}
                </span>
              </Link>
            );
          })}

          {/* More / menu */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open full menu"
            aria-expanded={open}
            className="flex flex-1 flex-col items-center justify-center gap-1
              rounded-xl py-2 text-muted-foreground transition-all duration-200
              hover:text-foreground active:bg-muted"
          >
            <Menu className="size-5" strokeWidth={2} aria-hidden="true" />
            <span
              className="text-[10px] font-semibold leading-none tracking-tight"
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Drawer portal */}
      {mounted &&
        createPortal(
          <div className="md:hidden">
            {/* Backdrop */}
            <div
              onClick={() => setOpen(false)}
              className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm
              transition-opacity duration-300 ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />

            {/* Sheet */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className={`fixed inset-x-0 bottom-0 z-[9999] transform
              transition-transform duration-300 ease-out ${
                open ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div
                className="overflow-hidden rounded-t-3xl border-t border-border
                  bg-card pb-[max(env(safe-area-inset-bottom),1.5rem)]
                  shadow-[0_-8px_40px_rgba(0,0,0,0.4)]"
              >
                {/* Grab handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <span
                    className="h-1.5 w-10 rounded-full bg-border"
                    aria-hidden="true"
                  />
                </div>

                {/* Header */}
                <div
                  className="flex items-center justify-between px-5 pb-4 pt-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-9 items-center justify-center
                        rounded-xl bg-primary text-primary-foreground"
                    >
                      <Wallet className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p
                        className="text-[11px] font-medium uppercase
                          tracking-wider text-muted-foreground"
                      >
                        utangz
                      </p>
                      <h2
                        className="text-base font-semibold leading-tight
                          text-foreground"
                      >
                        Navigation
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="flex size-9 items-center justify-center
                      rounded-full text-muted-foreground transition
                      hover:bg-muted hover:text-foreground active:scale-95"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-3 gap-3 px-5 pt-1">
                  {ALL_ITEMS.map(({ href, label, Icon }) => {
                    const isActive = isActivePath(pathname, href);
                    return (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={`group flex flex-col items-center gap-2.5
                        rounded-2xl border p-4 transition-all duration-200
                        active:scale-95 ${
                          isActive
                            ? "border-primary/50 bg-primary/10"
                            : `border-border bg-background hover:border-border
                              hover:bg-muted`
                        }`}
                      >
                        <span
                          className={`flex size-11 items-center justify-center
                          rounded-xl transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : `bg-muted text-muted-foreground
                                group-hover:text-foreground`
                          }`}
                        >
                          <Icon
                            className="size-5"
                            strokeWidth={isActive ? 2.5 : 2}
                            aria-hidden="true"
                          />
                        </span>
                        <span
                          className={`text-center text-[11px] font-semibold
                          leading-tight ${
                            isActive
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
