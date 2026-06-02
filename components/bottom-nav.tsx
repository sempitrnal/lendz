"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Users,
  Tag,
  ClipboardCheck,
  CalendarDays,
  Loader2,
  Moon,
  Sun,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/borrowers", label: "Borrowers", Icon: Users },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/categories", label: "Categories", Icon: Tag },
  { href: "/daily-checklist", label: "Checklist", Icon: ClipboardCheck },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    NAV_ITEMS.forEach(({ href }) => router.prefetch(href));
    router.prefetch("/accounts");
  }, [router]);

  function toggleDark() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <nav className="bg-background dark:border-border/50 dark:bg-background fixed right-0 bottom-0 left-0 z-50 border-t border-slate-900 shadow-[0_-2px_0_0_#0f172a] sm:hidden dark:shadow-[0_-2px_0_0_#0f172a] print:hidden">
      <ul className="flex h-[52px] items-stretch">
        {NAV_ITEMS.map(({ href, label, Icon }, i) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          const isLoading = isPending && pendingHref === href;
          return (
            <li
              key={href}
              className={`flex flex-1 ${i > 0 ? "dark:border-border border-l border-slate-900" : ""}`}
            >
              <button
                type="button"
                onPointerEnter={() => router.prefetch(href)}
                onPointerDown={() => {
                  setPendingHref(href);
                  startTransition(() => {
                    router.push(href);
                  });
                }}
                className={`relative flex flex-1 items-center justify-center transition-colors ${
                  isActive
                    ? "bg-green-300 text-slate-900 dark:bg-green-400"
                    : "dark:bg-card dark:text-muted-foreground dark:active:bg-muted bg-background text-slate-400 active:bg-slate-100"
                } ${isLoading ? "opacity-60" : ""}`}
              >
                {isActive && (
                  <span className="dark:bg-foreground absolute inset-x-0 top-0 h-[2px] bg-slate-900" />
                )}
                {isLoading ? (
                  <Loader2 className="dark:text-foreground size-6 animate-spin text-slate-700" />
                ) : (
                  <Icon
                    className="size-6"
                    strokeWidth={isActive ? 2.5 : 1.75}
                  />
                )}
              </button>
            </li>
          );
        })}
        <li className="dark:border-border flex w-12 shrink-0 border-l border-slate-900">
          <button
            type="button"
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            className="dark:bg-card dark:text-muted-foreground dark:active:bg-muted bg-background flex flex-1 items-center justify-center text-slate-400 transition-colors active:bg-slate-100"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-5" strokeWidth={1.75} />
            ) : (
              <Moon className="size-5" strokeWidth={1.75} />
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}
