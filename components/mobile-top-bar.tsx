"use client";

import { ACCENT_EVENT, getPageAccent } from "@/lib/accent-palette";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/theme-toggle";
import HeaderSearch from "@/components/header-search";
import {
  isAccountDetailPath,
  isBorrowerDetailPath,
  usePageOwnsMobileHeader,
} from "@/components/use-wallet-dashboard";

/** The band's default top colour (see --page-1 in globals.css), for the status bar. */
const THEME_LIGHT = "#059669";
const THEME_DARK = "#022c22";

/** Scroll distance (px) over which the bar's shadow fades in. */
const SHADOW_DISTANCE = 56;

const HIDE_ALL_PATHS = ["/login"];
const HIDE_BACK_PATHS = [
  "/",
  "/dashboard",
  "/borrowers",
  "/categories",
  "/daily-checklist",
  "/due-this-month",
];

export default function MobileTopBar({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const ownsHeader = usePageOwnsMobileHeader();
  const shadowRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  // The phone's status bar takes its colour from the theme-color tag. On a page
  // with a green band, match the band, so the status bar, the top bar and the
  // band read as one piece; elsewhere leave the tag out.
  useEffect(() => {
    if (!ownsHeader) return;
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    const dark = resolvedTheme === "dark";
    // A page with its own colour (a borrower's category) moves the strip too.
    const sync = () => {
      const accent = getPageAccent();
      meta.content = accent
        ? dark
          ? accent.dark.top
          : accent.light.top
        : dark
          ? THEME_DARK
          : THEME_LIGHT;
    };
    sync();
    document.head.appendChild(meta);
    window.addEventListener(ACCENT_EVENT, sync);
    return () => {
      window.removeEventListener(ACCENT_EVENT, sync);
      meta.remove();
    };
  }, [ownsHeader, resolvedTheme]);

  // On a page with its own green band the bar is solid green; only its shadow
  // fades in as you scroll, so it lifts off the band. It writes the opacity
  // straight to the element: no re-render per scroll frame.
  useEffect(() => {
    if (!ownsHeader) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const shadow = shadowRef.current;
        if (shadow) {
          const p = Math.min(1, Math.max(0, window.scrollY / SHADOW_DISTANCE));
          shadow.style.opacity = String(p);
        }
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
    };
  }, [ownsHeader, pathname]);

  // A borrower's or an account's header caps itself with its own shadow under
  // this bar.
  const capsItself =
    isBorrowerDetailPath(pathname) || isAccountDetailPath(pathname);
  const hideAll =
    HIDE_ALL_PATHS.includes(pathname) ||
    (pathname.startsWith("/accounts/") && pathname.endsWith("/view"));
  if (hideAll) return null;

  const showToggleOnly = HIDE_BACK_PATHS.some((p) => pathname === p);

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div
      className={cn(
        `dark:border-border/50 dark:bg-background fixed top-0 right-0 left-0
        z-40 flex h-16 items-center gap-2 border-b border-slate-200
        bg-background px-2 transition-colors duration-200 sm:hidden
        print:hidden`,
        // On the pages that draw their own green band, the bar is the band's
        // own green, solid from the first pixel (iOS tints its status strip
        // from the bar's colour, so a see-through bar showed up as white), and
        // stays mounted, so moving between them only swaps what's below it.
        ownsHeader &&
          `border-transparent bg-(--page-1) px-4 dark:border-transparent
          dark:bg-(--page-1)`,
      )}
    >
      {ownsHeader && !capsItself && (
        <div
          ref={shadowRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-4
            bg-linear-to-b from-emerald-950/25 to-transparent opacity-0"
        />
      )}
      {showToggleOnly ? (
        <div
          className={`shrink-0 overflow-hidden transition-all duration-200
            ease-in-out ${
              searchFocused ? "max-w-0 opacity-0" : "max-w-4 opacity-100"
            }`}
        />
      ) : (
        <div
          className={`shrink-0 overflow-hidden transition-all duration-200
            ease-in-out ${
              searchFocused ? "max-w-0 opacity-0" : "max-w-10 opacity-100"
            }`}
        >
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className={cn(
              `dark:border-border dark:bg-card dark:text-foreground flex
                items-center justify-center rounded-lg border border-slate-300
                bg-white p-2 text-slate-600 transition active:shadow-none`,
              // On the green bar the button is a translucent white disc.
              ownsHeader &&
                `border-transparent bg-onpage/20 text-onpage
                  dark:border-transparent dark:bg-onpage/20 dark:text-onpage`,
            )}
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
      {isLoggedIn && (
        <HeaderSearch
          className="flex-1"
          onColor={ownsHeader}
          onFocusChange={setSearchFocused}
        />
      )}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-200
          ease-in-out ${
            searchFocused ? "max-w-0 opacity-0" : "max-w-10 opacity-100"
          }`}
      >
        <ThemeToggle size="icon-sm" onColor={ownsHeader} />
      </div>
      {ownsHeader && (
        <Link
          href="/upcoming"
          aria-label="Overdue"
          className={`shrink-0 text-onpage transition-all duration-200 ${
            searchFocused ? "max-w-0 opacity-0" : "max-w-10 opacity-100"
          }`}
        >
          <Bell className="size-5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
