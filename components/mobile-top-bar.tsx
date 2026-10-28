"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/theme-toggle";
import HeaderSearch from "@/components/header-search";
import { usePageOwnsMobileHeader } from "@/components/use-wallet-dashboard";

/** Scroll distance (px) over which the green bar fills in. */
const FILL_DISTANCE = 56;

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
  const fillRef = useRef<HTMLDivElement>(null);

  // On a page with its own green band the bar starts see-through, so it reads
  // as part of the band, and fills in as you scroll. It writes the opacity
  // straight to the element: no re-render per scroll frame.
  useEffect(() => {
    if (!ownsHeader) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const fill = fillRef.current;
        if (fill) {
          const p = Math.min(1, Math.max(0, window.scrollY / FILL_DISTANCE));
          fill.style.opacity = String(p);
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
        // On the pages that draw their own green band, the bar turns green and
        // stays mounted, so moving between them only swaps what's below it.
        ownsHeader &&
          `border-transparent bg-transparent px-4 dark:border-transparent
          dark:bg-transparent`,
      )}
    >
      {ownsHeader && (
        <div
          ref={fillRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-emerald-600
            opacity-0 shadow-md shadow-emerald-900/20"
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
            className="dark:border-border dark:bg-card dark:text-foreground flex
              items-center justify-center rounded-lg border border-slate-300
              bg-white p-2 text-slate-600 transition active:shadow-none"
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
        <ThemeToggle size="icon-sm" />
      </div>
      {ownsHeader && (
        <Link
          href="/upcoming"
          aria-label="Overdue"
          className={`shrink-0 text-white transition-all duration-200 ${
            searchFocused ? "max-w-0 opacity-0" : "max-w-10 opacity-100"
          }`}
        >
          <Bell className="size-5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
