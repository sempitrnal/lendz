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

/**
 * True where the page draws its own green top band on a phone: the wallet
 * dashboard, the checklist and a borrower's page. The global mobile top bar
 * turns green there.
 */
export function usePageOwnsMobileHeader() {
  const pathname = usePathname();
  const walletDashboard = useWalletDashboard();
  return (
    walletDashboard ||
    pathname === "/daily-checklist" ||
    isBorrowerDetailPath(pathname)
  );
}
