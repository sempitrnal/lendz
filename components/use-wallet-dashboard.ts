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
