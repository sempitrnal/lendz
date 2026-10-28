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

/**
 * True where the page draws its own green top band on a phone: the wallet
 * dashboard and the checklist. The global mobile top bar steps aside there.
 */
export function usePageOwnsMobileHeader() {
  const pathname = usePathname();
  const walletDashboard = useWalletDashboard();
  return walletDashboard || pathname === "/daily-checklist";
}
