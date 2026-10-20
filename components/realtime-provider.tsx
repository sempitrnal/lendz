"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { BORROWERS_SEARCH_KEY } from "@/hooks/use-borrowers-search";
import { refreshCachedAccounts } from "@/lib/checklist/schedule-cache";
import { isConnectionGood } from "@/lib/offline/connection";

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

/** A tab hidden for less than this doesn't refetch the page when it returns. */
const STALE_AFTER_HIDDEN_MS = 30_000;
/** Events inside this window share one refresh; a burst of rows is one burst. */
const REFRESH_WINDOW_MS = 1000;

/**
 * Whether a change to `table` shows up in something the server renders on
 * `pathname`. The checklist and the borrower's notes are fetched by the client
 * (and kept fresh by their own queries), so refreshing the page for them would
 * only re-run every query on the page for nothing.
 */
function needsPageRefresh(table: string, pathname: string | null) {
  if (table === "daily_checklist_items") return false;
  if (table === "daily_checklist_categories") return false;
  if (table === "calendar_events") return !!pathname?.startsWith("/calendar");
  if (table === "borrower_notes") return pathname === "/borrowers";
  return true;
}

export default function RealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // The channel is set up once; the current path is read when an event lands.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
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
    const refresh = (delay = REFRESH_WINDOW_MS) => {
      // Later events join the refresh already waiting instead of pushing it
      // back, so a long burst can't hold the page stale.
      if (refreshTimerRef.current) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        // On a dead or crawling link a refresh can end in a full page reload.
        if (isConnectionGood()) router.refresh();
      }, delay);
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
          if (needsPageRefresh(table, pathnameRef.current)) refresh();

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
      if (err) console.error("[realtime] subscription error:", err);
    });

    let hiddenAt: number | null = null;
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const awayFor = hiddenAt === null ? Infinity : Date.now() - hiddenAt;
      hiddenAt = null;
      if (awayFor >= STALE_AFTER_HIDDEN_MS && isConnectionGood()) {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // Give the connection monitor a moment to confirm the link is good again.
    const onOnline = () => window.setTimeout(() => refresh(0), 1500);
    window.addEventListener("online", onOnline);

    // Fallback polling for pages where schedule/borrower data must stay current
    pollRef.current = window.setInterval(() => {
      // Realtime already pushes changes — only poll as a fallback while
      // the channel is down, otherwise this is a wasted render + queries.
      if (realtimeOk.current) return;
      const path = pathnameRef.current;
      const watched =
        path === "/accounts" ||
        path?.startsWith("/accounts/") ||
        path === "/borrowers" ||
        path?.startsWith("/borrowers/");
      if (watched && document.visibilityState === "visible") refresh();
    }, 10000) as unknown as number;

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      // The pending offline-cache refresh is left to fire, so unmounting right
      // after editing an account still updates the offline copy.
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [router, queryClient]);

  return <>{children}</>;
}
