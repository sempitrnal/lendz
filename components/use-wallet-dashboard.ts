"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * True on the wallet-style dashboard, whose green header carries its own
 * search, so the global header search steps aside there.
 */
export function useWalletDashboard() {
  const pathname = usePathname();
  const params = useSearchParams();
  return pathname === "/dashboard" && params.get("view") !== "classic";
}

/** A borrower's own page, `/borrowers/<id>` (not the list or their edit page). */
export function isBorrowerDetailPath(pathname: string) {
  return /^\/borrowers\/[^/]+$/.test(pathname);
}

/** One account's own page, `/accounts/<id>` (not its public view). */
export function isAccountDetailPath(pathname: string) {
  return /^\/accounts\/[^/]+$/.test(pathname);
}

/**
 * True where the page draws its own green top band on a phone: the wallet
 * dashboard, the checklist, the release plan, a borrower's page and an account's page. The
 * global mobile top bar turns green there.
 */
export function usePageOwnsMobileHeader() {
  const pathname = usePathname();
  const walletDashboard = useWalletDashboard();
  return (
    walletDashboard ||
    pathname === "/daily-checklist" ||
    pathname === "/releases" ||
    pathname === "/borrowers" ||
    pathname === "/categories" ||
    pathname.startsWith("/categories/") ||
    isBorrowerDetailPath(pathname) ||
    isAccountDetailPath(pathname)
  );
}
