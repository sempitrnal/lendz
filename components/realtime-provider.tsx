"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { BORROWERS_SEARCH_KEY } from "@/hooks/use-borrowers-search";
import { refreshCachedAccounts } from "@/lib/checklist/schedule-cache";

const REALTIME_TABLES = [
  "accounts",
  "borrower_categories",
  "borrower_notes",
  "borrowers",
  "calendar_events",
  "categories",
  "daily_checklist_categories",
  "daily_checklist_items",
  "payment_schedules",
  "schedule_payments",
];

export default function RealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const refreshTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const realtimeOk = useRef(false);
  /** Accounts/schedules changed since the last offline-cache refresh. */
  const staleRef = useRef({
    accounts: new Set<string>(),
    schedules: new Set<string>(),
  });
  const cacheTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        router.refresh();
      }, 300);
    };

    // Batch bursts (marking many schedules paid fires one event each) into a
    // single refresh of the offline copy of the checklist's account data.
    const markCacheStale = (table: string, row: Record<string, unknown>) => {
      const stale = staleRef.current;
      if (table === "accounts" && row.id) stale.accounts.add(String(row.id));
      if (table === "payment_schedules") {
        if (row.account_id) stale.accounts.add(String(row.account_id));
        else if (row.id) stale.schedules.add(String(row.id));
      }
      if (cacheTimerRef.current) window.clearTimeout(cacheTimerRef.current);
      cacheTimerRef.current = window.setTimeout(() => {
        const accounts = [...stale.accounts];
        const schedules = [...stale.schedules];
        stale.accounts.clear();
        stale.schedules.clear();
        void refreshCachedAccounts(accounts, schedules).catch(() => {});
      }, 1000);
    };

    const channel = supabase.channel("global-crud-realtime");

    REALTIME_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload: unknown) => {
          console.log(`[realtime] ${table} change:`, payload);
          refresh();

          // Mention dropdown, pill colors and checklist grouping read this list.
          if (
            ["borrowers", "borrower_categories", "categories"].includes(table)
          ) {
            queryClient.invalidateQueries({ queryKey: BORROWERS_SEARCH_KEY });
          }

          const row = (payload as any)?.new ?? (payload as any)?.old ?? {};
          if (table === "accounts" || table === "payment_schedules") {
            // On DELETE `new` is `{}`, so fall back to `old` for the ids.
            const { new: next, old: prev } = payload as {
              new?: Record<string, unknown>;
              old?: Record<string, unknown>;
            };
            markCacheStale(table, next?.id !== undefined ? next : (prev ?? {}));
          }
          const borrowerId =
            row.borrower_id ??
            (table === "borrowers" ? row.id : undefined) ??
            (table === "accounts" ? row.borrower_id : undefined);
          if (borrowerId) {
            queryClient.invalidateQueries({
              queryKey: ["borrower", borrowerId],
            });
          } else if (
            ["borrower_notes", "accounts", "borrowers"].includes(table)
          ) {
            queryClient.invalidateQueries({ queryKey: ["borrower"] });
          }
        },
      );
    });

    realtimeOk.current = false;
    channel.subscribe((status: string, err?: Error) => {
      realtimeOk.current = status === "SUBSCRIBED";
      if (err) {
        console.error("[realtime] subscription error:", err);
      } else {
        console.log("[realtime] subscription status:", status);
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);

    // Fallback polling for pages where schedule/borrower data must stay current
    if (
      pathname === "/accounts" ||
      pathname?.startsWith("/accounts/") ||
      pathname === "/borrowers" ||
      pathname?.startsWith("/borrowers/")
    ) {
      pollRef.current = window.setInterval(() => {
        // Realtime already pushes changes — only poll as a fallback while
        // the channel is down, otherwise this is a wasted render + queries.
        if (realtimeOk.current) return;
        if (document.visibilityState === "visible") {
          refresh();
        }
      }, 10000) as unknown as number;
    }

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      // The pending offline-cache refresh is left to fire: this effect re-runs
      // on every navigation, and editing an account then moving on is common.
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [router, pathname]);

  return <>{children}</>;
}
