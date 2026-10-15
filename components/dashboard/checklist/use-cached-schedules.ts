"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  readCachedSchedules,
  scheduleCacheVersion,
  subscribeScheduleCache,
  type ScheduleDialogRow,
} from "@/lib/checklist/schedule-cache";

/**
 * Saved schedule rows for `ids`, by id, re-read whenever the schedule cache
 * changes (a refresh, a realtime update, a payment saved here or offline).
 * Empty on the server render; rows the device hasn't saved are absent.
 */
export function useCachedSchedules(
  ids: string[],
): Map<string, ScheduleDialogRow> {
  const version = useSyncExternalStore(
    subscribeScheduleCache,
    scheduleCacheVersion,
    () => -1,
  );
  const key = ids.join(",");
  return useMemo(
    () =>
      version < 0
        ? new Map()
        : new Map(
            readCachedSchedules(key ? key.split(",") : []).map((r) => [
              r.id,
              r,
            ]),
          ),
    [version, key],
  );
}
