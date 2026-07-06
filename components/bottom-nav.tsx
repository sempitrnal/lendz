"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  Loader2,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/borrowers", label: "Borrowers", Icon: Users },
  { href: "/accounts", label: "Accounts", Icon: Wallet },
  { href: "/due-this-month", label: "Due This Month", Icon: CalendarClock },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/categories", label: "Categories", Icon: Tag },
  { href: "/daily-checklist", label: "Checklist", Icon: ClipboardCheck },
  { href: "/deleted", label: "Trash", Icon: Trash2 },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    NAV_ITEMS.forEach(({ href }) => router.prefetch(href));
  }, [router]);

  const handleNavigate = (href: string) => {
    setPendingHref(href);
    setOpen(false);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <>
      {/* Bottom bar */}
      <nav
        onClick={() => setOpen(true)}
        className="bg-background dark:border-border/50 dark:bg-background fixed
          right-0 bottom-0 left-0 z-50 border-t border-slate-200 sm:hidden
          print:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
      >
        <div className="flex h-[52px] items-center px-4">
          <button
            type="button"
            className="dark:text-muted-foreground flex items-center gap-2
              text-sm font-bold text-slate-600 lowercase"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
            menu
          </button>
        </div>
      </nav>

      {/* Drawer — portalled to body to escape PageTransition transform stacking context */}
      {mounted &&
        createPortal(
          <>
            {open && (
              <div
                className="fixed inset-0 z-[9998] bg-black/50 sm:hidden"
                onClick={() => setOpen(false)}
              />
            )}
            <div
              className={`fixed right-0 bottom-0 left-0 z-[9999] transform
              transition-transform duration-300 ease-out sm:hidden ${
                open ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div
                className="dark:border-border rounded-t-2xl border-t
                  border-slate-300 bg-white dark:bg-card
                  dark:shadow-[0_-4px_0_0_#020617]"
              >
                {/* Drawer header */}
                <div
                  className="flex items-center justify-between border-b
                    border-slate-100 p-4 dark:border-border/50"
                >
                  <span
                    className="text-sm font-black text-slate-600 lowercase
                      dark:text-foreground"
                  >
                    navigation
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="dark:text-muted-foreground flex size-8
                      items-center justify-center rounded-md text-slate-500
                      transition active:bg-slate-100 dark:active:bg-muted"
                    aria-label="Close menu"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Drawer links */}
                <div className="grid grid-cols-3 gap-2 p-4">
                  {NAV_ITEMS.map(({ href, label, Icon }) => {
                    const isActive =
                      mounted &&
                      (pathname === href ||
                        (href !== "/dashboard" && pathname.startsWith(href)));
                    const isLoading = isPending && pendingHref === href;
                    return (
                      <button
                        key={href}
                        type="button"
                        onPointerEnter={() => router.prefetch(href)}
                        onClick={() => handleNavigate(href)}
                        className={`flex flex-col items-center gap-1.5
                        rounded-xl border-2 p-3 transition ${
                          isActive
                            ? `border-slate-300 bg-green-200 text-slate-600
                              dark:border-border dark:bg-green-900/40
                              dark:text-green-200`
                            : `border-slate-200 bg-white text-slate-600
                              active:bg-slate-100 dark:border-border/60
                              dark:bg-card dark:text-muted-foreground
                              dark:active:bg-muted`
                        } ${isLoading ? "opacity-60" : ""}`}
                      >
                        {isLoading ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <Icon
                            className="size-5"
                            strokeWidth={isActive ? 2.5 : 1.75}
                          />
                        )}
                        <span className="text-[10px] font-bold leading-tight">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
