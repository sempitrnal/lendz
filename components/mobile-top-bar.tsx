"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

const HIDE_ALL_PATHS = ["/login"];
const HIDE_BACK_PATHS = [
  "/",
  "/dashboard",
  "/borrowers",
  "/categories",
  "/daily-checklist",
];

export default function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();

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
    <div className="dark:border-border/50 dark:bg-background/90 fixed top-0 right-0 left-0 z-40 flex h-10 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:hidden print:hidden">
      {showToggleOnly ? (
        <div />
      ) : (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="dark:border-border dark:bg-card dark:text-foreground flex items-center gap-1.5 rounded-lg border border-slate-900 bg-white px-2 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#0f172a] transition active:shadow-none"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.5} />
          back
        </button>
      )}
      <ThemeToggle size="icon-sm" />
    </div>
  );
}
