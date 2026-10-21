"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_SUMMARIES_KEY } from "@/components/dashboard/checklist/use-record-payments";
import {
  loadAccountSummaries,
  loadSchedules,
  readCachedSchedules,
  readCachedSummaries,
  type ScheduleDialogRow,
} from "@/lib/checklist/schedule-cache";

export type LiveSchedules = {
  rows: ScheduleDialogRow[];
  /**
   * "ready" once the live rows are in (or, offline or when the live load
   * fails, the saved ones); only then may amounts be recorded from them.
   * "error": online, the load failed and nothing is saved.
   */
  status: "loading" | "ready" | "error";
};

/**
 * The rows behind a sheet's installments. Saved rows show at once for
 * layout; the live load replaces them, and nothing is paid before it lands.
 * Mount it per open (the sheets remount their content), so it loads once.
 */
export function useLiveSchedules(ids: string[]): LiveSchedules {
  const key = [...new Set(ids)].sort().join("|");
  const initial = (k: string): LiveSchedules & { key: string } => ({
    key: k,
    rows: k ? readCachedSchedules(k.split("|")) : [],
    status: k ? "loading" : "ready",
  });
  const [state, setState] = useState(() => initial(key));
  // Other installments: start over from their saved rows (the load below
  // fetches them), never show the previous ones as ready.
  if (state.key !== key) setState(initial(key));

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadSchedules(key.split("|")).then(
      (rows) => {
        if (!cancelled) setState({ key, rows, status: "ready" });
      },
      () => {
        if (!cancelled) setState({ key, rows: [], status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

/**
 * Type + paid/left of the accounts behind `scheduleIds` (the pay dialog's
 * query): live when online, the saved copy offline or while loading.
 */
export function useAccountSummaries(ids: string[]) {
  const scheduleIds = useMemo(() => [...new Set(ids)].sort(), [ids]);
  return useQuery({
    queryKey: [ACCOUNT_SUMMARIES_KEY, ...scheduleIds],
    queryFn: () => loadAccountSummaries(scheduleIds),
    // Offline the cache answers; React Query would otherwise pause the fetch.
    networkMode: "always",
    enabled: scheduleIds.length > 0,
    staleTime: 30_000,
    placeholderData: () => readCachedSummaries(scheduleIds) ?? undefined,
  });
}
