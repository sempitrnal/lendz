"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
  fetchChecklistCategories,
  fetchChecklistItems,
  readCachedCategories,
  readCachedItems,
  wasQueuedOffline,
  writeCachedCategories,
  writeCachedItems,
} from "@/lib/checklist/offline-cache";
import { getPendingOutboxCount } from "@/lib/offline/outbox";
import { warmScheduleCache } from "@/lib/checklist/schedule-cache";
import { resolveCategoryIds } from "@/lib/checklist/categories";
import {
  isEchoOfLocalState,
  type ItemChangePayload,
} from "@/lib/checklist/realtime";
import { createLoadSequence } from "@/lib/checklist/load-sequence";
import {
  changedShownIds,
  newRowSortOrders,
  sortDayItems,
} from "@/lib/checklist/day-items";
import type {
  ChecklistCategory,
  DailyChecklistItem,
} from "@/lib/checklist/types";

export type RemoveOutcome = "saved" | "queued" | "failed";

export type ChecklistItemsApi = {
  date: string;
  items: DailyChecklistItem[];
  categories: ChecklistCategory[];
  loading: boolean;
  releasedId: string | null;
  collectId: string | null;
  /** Item ids whose last write was queued offline and hasn't synced yet. */
  waitingIds: Set<string>;
  /** Item ids that just changed from elsewhere (another device or tab); cleared after about 2.5 s. */
  flashIds: Set<string>;
  /**
   * Adds the rows at once and resolves with them once the insert is saved or
   * queued offline (`onOutcome` says which); [] when it fails (an error toast
   * shows and the rows go).
   */
  addItems(
    rows: { label: string; categoryId: string | null; checked?: boolean }[],
    onOutcome?: (outcome: "saved" | "queued") => void,
  ): Promise<DailyChecklistItem[]>;
  setLabel(id: string, label: string): void;
  /**
   * Ticks or unticks the rows at once. `onOutcome` hears how the write ended:
   * "saved", "queued" (offline; it syncs later) or "failed" (the rows go back
   * and an error toast shows).
   */
  setChecked(
    ids: string[],
    checked: boolean,
    onOutcome?: (outcome: RemoveOutcome) => void,
  ): void;
  /**
   * Removes the rows at once and returns them, for Undo. `onSettled` hears how
   * the delete ended: "saved", "queued" (offline; it syncs later) or "failed"
   * (the rows are put back and an error toast shows).
   */
  removeItems(
    ids: string[],
    onSettled?: (outcome: RemoveOutcome) => void,
  ): DailyChecklistItem[];
  restoreItems(rows: DailyChecklistItem[]): Promise<void>;
};

/** Coming back to the tab refetches the day only after being away this long. */
const VISIBLE_REFETCH_AFTER_MS = 30_000;
/** Realtime bursts (a bulk write) collapse into one reload. */
const REALTIME_RELOAD_DEBOUNCE_MS = 300;
/** How long a row changed elsewhere stays in `flashIds`. */
const FLASH_MS = 2_500;

const ITEM_COLUMNS =
  "id, checklist_date, label, is_checked, sort_order, created_at, category_id";

type DbError = { message: string } | null;
type WriteResult = { data?: unknown; error: DbError };
/** The rows of one day, kept together so a day's rows never show as another's. */
type Day = { date: string; items: DailyChecklistItem[] };

const EMPTY_ITEMS: DailyChecklistItem[] = [];

/**
 * One day's checklist: the saved copy first, then the server; kept current by
 * realtime, the offline outbox and reconnects; with optimistic writes that
 * survive being queued offline. Data logic moved from `DailyNotesWidget`.
 */
export function useChecklistItems(date: string): ChecklistItemsApi {
  const [day, setDay] = useState<Day | null>(null);
  /** The date whose load has finished (shown, or failed with nothing to show). */
  const [settledDate, setSettledDate] = useState<string | null>(null);
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [waitingIds, setWaitingIds] = useState<Set<string>>(() => new Set());
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set());

  /** Bumped per load so a slow earlier load can't overwrite a newer day. */
  const [loadSeq] = useState(createLoadSequence);
  /** The rows on screen for `date`, for the echo check and change detection. */
  const itemsRef = useRef<DailyChecklistItem[]>(EMPTY_ITEMS);
  const waitingRef = useRef<Set<string>>(waitingIds);
  /** Ids with a write from this screen still waiting for its response. */
  const inFlightRef = useRef<Map<string, number>>(new Map());
  const flashTimersRef = useRef<Set<number>>(new Set());

  const items = useMemo(
    () => (day && day.date === date ? sortDayItems(day.items) : EMPTY_ITEMS),
    [day, date],
  );

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    waitingRef.current = waitingIds;
  }, [waitingIds]);

  /** Applies `fn` to the rows of `forDate` only if that day is the one held. */
  const updateDay = useCallback(
    (
      forDate: string,
      fn: (rows: DailyChecklistItem[]) => DailyChecklistItem[],
    ) => {
      setDay((prev) =>
        prev && prev.date === forDate
          ? { date: forDate, items: fn(prev.items) }
          : prev,
      );
    },
    [],
  );

  const markWaiting = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setWaitingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clearWaiting = useCallback(() => {
    setWaitingIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const flash = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setFlashIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    const timer = window.setTimeout(() => {
      flashTimersRef.current.delete(timer);
      setFlashIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }, FLASH_MS);
    flashTimersRef.current.add(timer);
  }, []);

  /** Tracks a write from this screen so its rows don't flash as remote changes. */
  const trackWrite = useCallback(
    (
      ids: string[],
      run: () => PromiseLike<WriteResult>,
    ): Promise<WriteResult> => {
      const inFlight = inFlightRef.current;
      for (const id of ids) inFlight.set(id, (inFlight.get(id) ?? 0) + 1);
      const done = () => {
        for (const id of ids) {
          const left = (inFlight.get(id) ?? 1) - 1;
          if (left <= 0) inFlight.delete(id);
          else inFlight.set(id, left);
        }
      };
      return Promise.resolve(run()).finally(done);
    },
    [],
  );

  const loadCategories = useCallback(async () => {
    // Show the saved categories at once; the fetch below refreshes them.
    const cached = readCachedCategories();
    if (cached) setCategories(cached);
    if (!navigator.onLine && cached) return;
    const { categories: loaded, error } = await fetchChecklistCategories();
    if (error) {
      if (!cached) toast.error(error.message);
      return;
    }
    setCategories(loaded);
    writeCachedCategories(loaded);
  }, []);

  const loadItems = useCallback(
    async (
      targetDate: string,
      { initial = false, detectChanges = false } = {},
    ) => {
      const seq = loadSeq.next();
      const showItems = (rows: DailyChecklistItem[]) => {
        setDay({ date: targetDate, items: rows });
        setSettledDate(targetDate);
      };
      // Show the saved day at once (no skeleton) and refresh it below.
      const cached = readCachedItems(targetDate);
      if (cached) showItems(cached);
      // Offline, or offline edits still waiting to sync: the local snapshot is
      // newer than what the server (or the SW's response cache) would return.
      if (cached) {
        if (!navigator.onLine) return;
        const pending = await getPendingOutboxCount();
        if (!loadSeq.isCurrent(seq) || pending > 0) return;
      }
      const { items: fetched, error } = await fetchChecklistItems(targetDate);
      if (!loadSeq.isCurrent(seq)) return;

      if (error) {
        if (cached) {
          // Already showing the saved copy.
        } else if (navigator.onLine) {
          toast.error(error.message);
          setSettledDate(targetDate);
        } else showItems([]);
        return;
      }

      if (detectChanges) {
        // Only the rows on screen for this day can be "already shown".
        const shown = itemsRef.current.filter(
          (row) => row.checklist_date === targetDate,
        );
        const exclude = new Set([
          ...inFlightRef.current.keys(),
          ...waitingRef.current,
        ]);
        flash(changedShownIds(shown, fetched, exclude));
      }
      showItems(fetched);
      clearWaiting();
      if (initial) {
        // Ready the payment dialogs for this day in case the connection drops.
        void warmScheduleCache(fetched.map((i) => i.label)).catch(() => {});
      }
    },
    [loadSeq, flash, clearWaiting],
  );

  // Categories don't depend on the day, so they load once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the saved categories from localStorage, then fetches
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the saved day from localStorage, then fetches
    void loadItems(date, { initial: true });
  }, [date, loadItems]);

  // Keep the offline snapshot in step with every change, optimistic ones
  // included. Rows are stored with the day they belong to, so a previous
  // day's rows are never written under the new date.
  useEffect(() => {
    if (day) writeCachedItems(day.date, day.items);
  }, [day]);

  // Reload once the outbox has replayed offline edits, or on reconnect.
  useEffect(() => {
    const reload = () => {
      clearWaiting();
      void loadCategories();
      void loadItems(date);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "OUTBOX_RESULT") reload();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    window.addEventListener("online", reload);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("online", reload);
    };
  }, [date, loadItems, loadCategories, clearWaiting]);

  useEffect(() => {
    let refreshTimer: number | null = null;
    const channel = supabase
      .channel(`daily-checklist-items-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_checklist_items",
          filter: `checklist_date=eq.${date}`,
        },
        (payload: ItemChangePayload) => {
          // Our own write comes back as an event too. If the screen already
          // matches it there is nothing to fetch, and a fetch could land
          // before the write commits and undo it.
          if (isEchoOfLocalState(payload, itemsRef.current)) return;
          if (refreshTimer !== null) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => {
            refreshTimer = null;
            void loadItems(date, { detectChanges: true });
          }, REALTIME_RELOAD_DEBOUNCE_MS);
        },
      )
      .subscribe();

    // The channel keeps the list current; only a long absence (when it may
    // have dropped) is worth a refetch on return.
    let hiddenAt: number | null = null;
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const awayFor = hiddenAt === null ? Infinity : Date.now() - hiddenAt;
      hiddenAt = null;
      if (awayFor >= VISIBLE_REFETCH_AFTER_MS) void loadItems(date);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [date, loadItems]);

  // Flashes belong to the day they happened on.
  useEffect(() => {
    const timers = flashTimersRef.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      setFlashIds((prev) => (prev.size === 0 ? prev : new Set()));
    };
  }, [date]);

  const { releasedId, collectId } = useMemo(
    () => resolveCategoryIds(categories),
    [categories],
  );

  const addItems = useCallback(
    async (
      rows: { label: string; categoryId: string | null; checked?: boolean }[],
      onOutcome?: (outcome: "saved" | "queued") => void,
    ): Promise<DailyChecklistItem[]> => {
      if (rows.length === 0) return [];
      const targetDate = date;
      const sortOrders = newRowSortOrders(itemsRef.current, rows);
      const createdAt = new Date().toISOString();
      // The ids are generated here so a row added offline keeps its id once
      // the outbox replays the insert, and later edits to it still match.
      const created: DailyChecklistItem[] = rows.map((row, idx) => ({
        id: crypto.randomUUID(),
        checklist_date: targetDate,
        label: row.label,
        is_checked: row.checked ?? false,
        sort_order: sortOrders[idx],
        created_at: createdAt,
        category_id: row.categoryId,
        daily_checklist_categories:
          categories.find((c) => c.id === row.categoryId) ?? null,
      }));
      const ids = created.map((row) => row.id);

      updateDay(targetDate, (prev) => [...created, ...prev]);

      const payload = created.map((row) => ({
        id: row.id,
        checklist_date: row.checklist_date,
        label: row.label,
        is_checked: row.is_checked,
        sort_order: row.sort_order,
        created_at: row.created_at,
        ...(row.category_id ? { category_id: row.category_id } : {}),
      }));
      const { data, error } = (await trackWrite(ids, () =>
        supabase
          .from("daily_checklist_items")
          .insert(payload)
          .select(ITEM_COLUMNS),
      )) as { data: Partial<DailyChecklistItem>[] | null; error: DbError };

      if (wasQueuedOffline(error)) {
        markWaiting(ids);
        onOutcome?.("queued");
        return created;
      }
      if (error) {
        toast.error(error.message);
        const drop = new Set(ids);
        updateDay(targetDate, (prev) => prev.filter((i) => !drop.has(i.id)));
        return [];
      }
      onOutcome?.("saved");

      const saved = new Map((data ?? []).map((row) => [row.id, row]));
      const result = created.map((row) => {
        const s = saved.get(row.id);
        return s?.created_at ? { ...row, created_at: s.created_at } : row;
      });
      updateDay(targetDate, (prev) =>
        prev.map((i) => result.find((r) => r.id === i.id) ?? i),
      );
      return result;
    },
    [date, categories, updateDay, trackWrite, markWaiting],
  );

  const setLabel = useCallback(
    (id: string, label: string) => {
      const targetDate = date;
      const before = itemsRef.current.find((i) => i.id === id);
      updateDay(targetDate, (prev) =>
        prev.map((row) => (row.id === id ? { ...row, label } : row)),
      );
      void trackWrite([id], () =>
        supabase.from("daily_checklist_items").update({ label }).eq("id", id),
      ).then(({ error }: { error: DbError }) => {
        if (wasQueuedOffline(error)) markWaiting([id]);
        else if (error) {
          toast.error(error.message);
          // Put the old label back unless it has been edited again since.
          if (before) {
            updateDay(targetDate, (prev) =>
              prev.map((row) =>
                row.id === id && row.label === label
                  ? { ...row, label: before.label }
                  : row,
              ),
            );
          }
        }
      });
    },
    [date, updateDay, trackWrite, markWaiting],
  );

  const setChecked = useCallback(
    (
      ids: string[],
      checked: boolean,
      onOutcome?: (outcome: RemoveOutcome) => void,
    ) => {
      if (ids.length === 0) return;
      const targetDate = date;
      const idSet = new Set(ids);
      const before = new Map(
        itemsRef.current
          .filter((i) => idSet.has(i.id))
          .map((i) => [i.id, i.is_checked]),
      );
      updateDay(targetDate, (prev) =>
        prev.map((row) =>
          idSet.has(row.id) ? { ...row, is_checked: checked } : row,
        ),
      );
      void trackWrite(ids, () =>
        supabase
          .from("daily_checklist_items")
          .update({ is_checked: checked })
          .in("id", ids),
      ).then(({ error }: { error: DbError }) => {
        if (wasQueuedOffline(error)) {
          markWaiting(ids);
          onOutcome?.("queued");
        } else if (error) {
          toast.error(error.message);
          updateDay(targetDate, (prev) =>
            prev.map((row) =>
              before.has(row.id) && row.is_checked === checked
                ? { ...row, is_checked: before.get(row.id)! }
                : row,
            ),
          );
          onOutcome?.("failed");
        } else onOutcome?.("saved");
      });
    },
    [date, updateDay, trackWrite, markWaiting],
  );

  const removeItems = useCallback(
    (
      ids: string[],
      onSettled?: (outcome: RemoveOutcome) => void,
    ): DailyChecklistItem[] => {
      const idSet = new Set(ids);
      const removed = itemsRef.current.filter((i) => idSet.has(i.id));
      if (removed.length === 0) return [];
      const targetDate = date;
      const removedIds = removed.map((r) => r.id);
      updateDay(targetDate, (prev) => prev.filter((i) => !idSet.has(i.id)));

      void trackWrite(removedIds, () =>
        supabase.from("daily_checklist_items").delete().in("id", removedIds),
      ).then(
        ({ error }: { error: DbError }) => {
          if (wasQueuedOffline(error)) {
            markWaiting(removedIds);
            onSettled?.("queued");
          } else if (error) {
            toast.error(error.message);
            updateDay(targetDate, (prev) => [
              ...prev,
              ...removed.filter((r) => !prev.some((i) => i.id === r.id)),
            ]);
            onSettled?.("failed");
          } else onSettled?.("saved");
        },
        () => {
          // The write itself threw: we can't tell if it ran. Put the row back
          // and say so, and always tell the caller (Undo waits on it).
          toast.error("Couldn't remove it. Check the list.");
          updateDay(targetDate, (prev) => [
            ...prev,
            ...removed.filter((r) => !prev.some((i) => i.id === r.id)),
          ]);
          onSettled?.("failed");
        },
      );
      return removed;
    },
    [date, updateDay, trackWrite, markWaiting],
  );

  const restoreItems = useCallback(
    async (rows: DailyChecklistItem[]): Promise<void> => {
      if (rows.length === 0) return;
      const targetDate = date;
      const ids = rows.map((r) => r.id);
      updateDay(targetDate, (prev) => [
        ...prev,
        ...rows.filter(
          (r) =>
            r.checklist_date === targetDate && !prev.some((i) => i.id === r.id),
        ),
      ]);
      const { error } = (await trackWrite(ids, () =>
        supabase.from("daily_checklist_items").insert(
          rows.map((item) => ({
            id: item.id,
            checklist_date: item.checklist_date,
            label: item.label,
            is_checked: item.is_checked,
            sort_order: item.sort_order,
            created_at: item.created_at,
            category_id: item.category_id ?? null,
          })),
        ),
      )) as { error: DbError };
      if (wasQueuedOffline(error)) {
        markWaiting(ids);
        return;
      }
      if (error) {
        toast.error(error.message);
        const drop = new Set(ids);
        updateDay(targetDate, (prev) => prev.filter((i) => !drop.has(i.id)));
      }
    },
    [date, updateDay, trackWrite, markWaiting],
  );

  return {
    date,
    items,
    categories,
    loading: settledDate !== date,
    releasedId,
    collectId,
    waitingIds,
    flashIds,
    addItems,
    setLabel,
    setChecked,
    removeItems,
    restoreItems,
  };
}
