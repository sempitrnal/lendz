"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import HeaderSearch from "@/components/header-search";

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
      className="dark:border-border/50 dark:bg-background fixed top-0 right-0
        left-0 z-40 flex h-16 items-center gap-2 border-b border-slate-200
        bg-background px-2 sm:hidden print:hidden"
    >
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
        <HeaderSearch className="flex-1" onFocusChange={setSearchFocused} />
      )}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-200
          ease-in-out ${
            searchFocused ? "max-w-0 opacity-0" : "max-w-10 opacity-100"
          }`}
      >
        <ThemeToggle size="icon-sm" />
      </div>
    </div>
  );
}
