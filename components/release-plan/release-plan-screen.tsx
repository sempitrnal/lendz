"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  CalendarArrowUp,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EASE_OUT, SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";
import { daysBetween, todayDateValue } from "@/lib/checklist/dates";
import { resolveCategoryIds } from "@/lib/checklist/categories";
import {
  fetchChecklistCategories,
  readCachedCategories,
  wasQueuedOffline,
} from "@/lib/checklist/offline-cache";
import {
  readCachedPlan,
  readCustomDates,
  saveCustomDates,
  writeCachedPlan,
} from "@/lib/checklist/release-plan-cache";
import { buildReleaseView } from "@/lib/checklist/release-items";
import {
  type MonthKey,
  type PlanEntry,
  type PlanFilter,
  filterCounts,
  filterPlan,
  isPatternDate,
  monthKeyOf,
  monthRange,
  planDates,
  planEntries,
  planTotal,
  shiftMonth,
  shortAmount,
} from "@/lib/checklist/release-plan";
import type { DailyChecklistItem } from "@/lib/checklist/types";
import AnimatedNumber from "@/components/animated-number";
import { BAR_PX, useCollapsingBand } from "@/components/borrower/borrower-band";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import {
  NEAR_WHITE_BORDER,
  isNearWhite,
} from "@/components/dashboard/checklist/dom";
import { useChecklistItems } from "@/components/dashboard/checklist-v2/use-checklist-items";
import { AddSheet } from "@/components/dashboard/checklist-v2/add-sheet";
import { ReleaseEditSheet } from "@/components/dashboard/checklist-v2/release-sheets";
import { MenuEntry } from "@/components/dashboard/checklist-v2/row-sheets";
import { Sheet } from "@/components/dashboard/checklist-v2/sheet";

const noopSubscribe = () => () => {};
const NO_BORROWERS: BorrowerSearchItem[] = [];

const monthTitle = (month: MonthKey) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const dayParts = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    label: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    weekday: d.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    }),
  };
};

const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-US")}`;

/** "today", "tomorrow", "in 5 days". */
const inDays = (from: string, to: string) => {
  const n = daysBetween(from, to);
  return n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
};

type SheetAsk =
  | { kind: "add"; date: string }
  | { kind: "menu"; id: string }
  | { kind: "edit"; id: string };
type SheetRequest = SheetAsk & { seq: number };

/** A plan as stored: the checklist row without its joined category. */
const rowOf = (item: DailyChecklistItem) => ({
  id: item.id,
  checklist_date: item.checklist_date,
  label: item.label,
  is_checked: item.is_checked,
  sort_order: item.sort_order,
  created_at: item.created_at,
  category_id: item.category_id,
});

/**
 * The release planner: a green band with the month's planned total, then the
 * month's release days, two to a row, each listing who gets what that day.
 * Its entries are the Release tab's items on those days, so planning here
 * puts the release on that day's checklist, and creating its account there
 * shows it done here. Tapping an entry edits, moves or deletes it.
 *
 * Today is only known on the device, so the server render is a skeleton.
 */
export default function ReleasePlanScreen() {
  const today = useSyncExternalStore(noopSubscribe, todayDateValue, () => null);
  if (today === null) return <PlanSkeleton />;
  return <ReleasePlan today={today} />;
}

function ReleasePlan({ today }: { today: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const thisMonth = monthKeyOf(today);
  // The month lives in the URL (`?month=2026-11`) so a reload stays on it.
  const [month, setMonthState] = useState<MonthKey>(() => {
    const value = new URLSearchParams(window.location.search).get("month");
    return value && /^\d{4}-\d{2}$/.test(value) ? value : thisMonth;
  });
  /** Which way the last month change went, for the slide. */
  const [direction, setDirection] = useState(1);
  const setMonth = (next: MonthKey) => {
    setDirection(next > month ? 1 : -1);
    setMonthState(next);
    const cached = readCachedPlan(next);
    if (cached) setLoaded({ month: next, items: cached });
    const url = new URL(window.location.href);
    if (next === thisMonth) url.searchParams.delete("month");
    else url.searchParams.set("month", next);
    window.history.replaceState(null, "", url);
  };

  const [releasedId, setReleasedId] = useState<string | null>(
    () => resolveCategoryIds(readCachedCategories() ?? []).releasedId,
  );
  /**
   * The month on screen and its releases. A month opened before shows its
   * saved copy at once while the server's loads; one never opened is null
   * (skeletons) until it lands.
   */
  const [loaded, setLoaded] = useState<{
    month: MonthKey;
    items: DailyChecklistItem[];
  } | null>(() => {
    const items = readCachedPlan(month);
    return items ? { month, items } : null;
  });
  const items = loaded?.month === month ? loaded.items : null;
  const monthRef = useRef(month);
  useEffect(() => {
    monthRef.current = month;
  }, [month]);
  /** Changes the shown month's releases (an add, edit, move or delete). */
  const setItems = (
    update: (prev: DailyChecklistItem[] | null) => DailyChecklistItem[],
  ) =>
    setLoaded((cur) => {
      const target = monthRef.current;
      return {
        month: target,
        items: update(cur?.month === target ? cur.items : null),
      };
    });
  // Every change is saved for next time, optimistic ones included.
  useEffect(() => {
    if (loaded) writeCachedPlan(loaded.month, loaded.items);
  }, [loaded]);
  const [failed, setFailed] = useState(false);
  // For each borrower's category; the checklist shares this list.
  const { data: borrowers = NO_BORROWERS } = useBorrowersSearch();
  /**
   * Days added by hand. They are kept on this device; a day with a release on
   * it shows anyway, since its checklist item keeps it.
   */
  const [extraDates, setExtraDatesState] = useState<string[]>(readCustomDates);
  const setExtraDates = (update: (prev: string[]) => string[]) =>
    setExtraDatesState((prev) => {
      const next = update(prev);
      saveCustomDates(next);
      return next;
    });
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const seq = useRef(0);
  const dateInput = useRef<HTMLInputElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const slab = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const headBg = useRef<HTMLDivElement>(null);
  const headShadow = useRef<HTMLDivElement>(null);
  const headStats = useRef<HTMLDivElement>(null);
  useCollapsingBand({
    head,
    slab,
    body,
    headBg,
    headShadow,
    headStats,
    statsPx: 0,
  });
  /** The latest load wins when months change quickly. */
  const loadSeq = useRef(0);

  const load = useCallback(async (target: MonthKey) => {
    const run = ++loadSeq.current;
    const { categories, error: catError } = await fetchChecklistCategories();
    if (run !== loadSeq.current) return;
    // Offline or failing: keep whatever is on screen (the saved copy).
    if (catError) {
      setFailed(true);
      return;
    }
    const { releasedId } = resolveCategoryIds(categories);
    setReleasedId(releasedId);
    if (!releasedId) {
      setFailed(false);
      setLoaded({ month: target, items: [] });
      return;
    }
    const { from, to } = monthRange(target);
    const { data, error } = await supabase
      .from("daily_checklist_items")
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id",
      )
      .eq("category_id", releasedId)
      .gte("checklist_date", from)
      .lte("checklist_date", to);
    if (run !== loadSeq.current) return;
    setFailed(!!error);
    if (error) return;
    setLoaded({
      month: target,
      items: (
        (data ?? []) as Omit<DailyChecklistItem, "daily_checklist_categories">[]
      ).map((row) => ({ ...row, daily_checklist_categories: null })),
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the month's releases load from the server
    void load(month);
  }, [month, load]);

  // A change on any checklist (here, another device, the checklist itself)
  // reloads the month, once per burst.
  useEffect(() => {
    let timer: number | null = null;
    const reload = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(month), 300);
    };
    const { from, to } = monthRange(month);
    const channel = supabase
      .channel(`release-plan-${month}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_checklist_items" },
        (payload: { new?: { checklist_date?: string } }) => {
          const date = payload.new?.checklist_date;
          if (!date || (date >= from && date <= to)) reload();
        },
      )
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", reload);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", reload);
    };
  }, [month, load]);

  const byDate = useMemo(
    () => planEntries(items ?? [], releasedId, borrowers),
    [items, releasedId, borrowers],
  );
  const dates = useMemo(
    () => planDates(month, [...byDate.keys(), ...extraDates]),
    [month, byDate, extraDates],
  );
  const all = useMemo(() => [...byDate.values()].flat(), [byDate]);
  const [filter, setFilter] = useState<PlanFilter>("all");
  const counts = useMemo(() => filterCounts(dates, byDate), [dates, byDate]);
  // While the month loads every day shows (as skeletons), whatever the filter.
  const shown = useMemo(
    () => filterPlan(dates, byDate, items === null ? "all" : filter),
    [dates, byDate, filter, items],
  );
  const total = planTotal(all);
  const created = all.filter((e) => e.done).length;
  const pct = all.length ? Math.round((created / all.length) * 100) : 0;
  const next = dates.find(
    (d) => d >= today && (byDate.get(d) ?? []).some((e) => !e.done),
  );
  const nextCount = next
    ? (byDate.get(next) ?? []).filter((e) => !e.done).length
    : 0;

  const open = (request: SheetAsk) => {
    seq.current += 1;
    setSheet({ ...request, seq: seq.current });
  };
  const closeSheet = () => setSheet(null);
  const itemOf = (id: string) => items?.find((i) => i.id === id) ?? null;

  // What the sheet adds shows at once, before the reload confirms it.
  const onAdded = (rows: DailyChecklistItem[]) => {
    if (rows.length === 0) return;
    setItems((prev) => {
      const known = new Set((prev ?? []).map((r) => r.id));
      return [...(prev ?? []), ...rows.filter((r) => !known.has(r.id))];
    });
  };
  /** Adds a custom day; `plan` also opens the composer on it. */
  const addDate = (date: string, plan = true) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (monthKeyOf(date) !== month) setMonth(monthKeyOf(date));
    if (!isPatternDate(date)) {
      setExtraDates((prev) =>
        prev.includes(date) ? prev : [...prev, date].sort(),
      );
    }
    if (plan) open({ kind: "add", date });
  };
  const removeDate = (date: string) =>
    setExtraDates((prev) => prev.filter((d) => d !== date));

  /**
   * Changes one plan on screen at once, then saves it. A write the outbox
   * queued offline keeps the change; one that failed puts the plan back.
   */
  const write = async (
    before: DailyChecklistItem,
    after: DailyChecklistItem | null,
    save: () => PromiseLike<{ error: unknown }>,
    failure: string,
  ) => {
    setItems((prev) =>
      after
        ? (prev ?? []).map((i) => (i.id === before.id ? after : i))
        : (prev ?? []).filter((i) => i.id !== before.id),
    );
    const { error } = await save();
    if (!error || wasQueuedOffline(error)) return true;
    setItems((prev) => {
      const rest = (prev ?? []).filter((i) => i.id !== before.id);
      return [...rest, before];
    });
    toast.error(failure);
    return false;
  };

  const setLabel = (id: string, label: string) => {
    const item = itemOf(id);
    if (!item) return;
    void write(
      item,
      { ...item, label },
      () =>
        supabase.from("daily_checklist_items").update({ label }).eq("id", id),
      "Couldn't save the release",
    );
  };

  const moveTo = (id: string, date: string) => {
    const item = itemOf(id);
    if (!item || !date || date === item.checklist_date) return;
    closeSheet();
    const inMonth = monthKeyOf(date) === month;
    void write(
      item,
      inMonth ? { ...item, checklist_date: date } : null,
      () =>
        supabase
          .from("daily_checklist_items")
          .update({ checklist_date: date })
          .eq("id", id),
      "Couldn't move the release",
    ).then((ok) => {
      if (ok) toast.success(`Moved to ${dayParts(date).label.toLowerCase()}`);
    });
  };

  const remove = (id: string) => {
    const item = itemOf(id);
    if (!item) return;
    closeSheet();
    const name = buildReleaseView(item).name || "Release";
    void write(
      item,
      null,
      () => supabase.from("daily_checklist_items").delete().eq("id", id),
      "Couldn't delete the release",
    ).then((ok) => {
      if (!ok) return;
      toast(`Deleted ${name.toLowerCase()}`, {
        action: {
          label: "Undo",
          onClick: () => {
            setItems((prev) => [...(prev ?? []), item]);
            void supabase
              .from("daily_checklist_items")
              .insert(rowOf(item))
              .then(({ error }: { error: unknown }) => {
                if (error && !wasQueuedOffline(error)) {
                  setItems((prev) =>
                    (prev ?? []).filter((i) => i.id !== item.id),
                  );
                  toast.error("Couldn't bring it back");
                }
              });
          },
        },
      });
    });
  };

  const loading = items === null;
  const sheetItem = sheet && sheet.kind !== "add" ? itemOf(sheet.id) : null;
  const slide = reduceMotion ? 0 : 48;

  return (
    <div className="mx-auto max-w-md pb-32 sm:max-w-3xl">
      {/* The band folds into a fixed header under the top bar as the page
          scrolls, as on a borrower's page (see useCollapsingBand). The header
          is just the month and its arrows; it is pinned from the start and
          the band's figures fold up beneath it. */}
      <div className="sticky z-30 h-0 sm:hidden" style={{ top: BAR_PX }}>
        <div
          ref={head}
          data-settle
          className="absolute inset-x-0 top-0 px-4 pt-1 pb-2.5 text-white"
        >
          <div
            ref={headBg}
            aria-hidden="true"
            className="absolute inset-0 rounded-b-3xl bg-(--page-1) opacity-0"
          />
          <div
            ref={headShadow}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-b-3xl
              opacity-0 shadow-[0_8px_14px_-6px_rgba(0,0,0,0.35)]"
          />
          <div className="relative flex items-center">
            <div className="flex min-w-0 items-center gap-0.5">
              <m.button
                type="button"
                whileTap={{ scale: 0.85, x: -3 }}
                transition={SPRING_PRESS}
                aria-label="Previous month"
                onClick={() => setMonth(shiftMonth(month, -1))}
                className="-ml-2 flex size-9 shrink-0 items-center
                  justify-center rounded-full active:bg-white/15"
              >
                <ChevronLeft className="size-5" />
              </m.button>
              <div className="relative min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span
                    key={month}
                    initial={{ y: direction * 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: direction * -14, opacity: 0 }}
                    transition={SPRING_SWAP}
                    className="block truncate px-1 text-xs font-bold
                      tracking-wider uppercase"
                  >
                    {monthTitle(month)}
                  </m.span>
                </AnimatePresence>
              </div>
              <m.button
                type="button"
                whileTap={{ scale: 0.85, x: 3 }}
                transition={SPRING_PRESS}
                aria-label="Next month"
                onClick={() => setMonth(shiftMonth(month, 1))}
                className="flex size-9 shrink-0 items-center justify-center
                  rounded-full active:bg-white/15"
              >
                <ChevronRight className="size-5" />
              </m.button>
            </div>
          </div>
        </div>
      </div>
      <div
        ref={slab}
        data-settle-group="band"
        className="sticky z-0 overflow-hidden px-4 text-white sm:relative
          sm:overflow-visible sm:px-5 sm:pt-5"
        style={{ top: BAR_PX - 300 }}
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="absolute inset-0 rounded-b-3xl
            bg-[linear-gradient(to_bottom,var(--page-1),var(--page-2))]
            sm:rounded-3xl"
        />
        <div
          aria-hidden="true"
          data-band-flat
          className="absolute inset-0 rounded-b-3xl bg-(--page-1) opacity-0
            sm:hidden"
        />
        <div
          ref={body}
          className="relative origin-top pb-14 will-change-transform"
        >
          {/* Wider screens have no top bar to dock into: the month sits here. */}
          <div className="relative z-20 hidden items-center sm:flex">
            <div className="flex min-w-0 items-center gap-0.5">
              <m.button
                type="button"
                whileTap={{ scale: 0.85, x: -3 }}
                transition={SPRING_PRESS}
                aria-label="Previous month"
                onClick={() => setMonth(shiftMonth(month, -1))}
                className="-ml-2 flex size-9 shrink-0 items-center
                  justify-center rounded-full active:bg-white/15"
              >
                <ChevronLeft className="size-5" />
              </m.button>
              <div className="relative min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span
                    key={month}
                    initial={{ y: direction * 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: direction * -14, opacity: 0 }}
                    transition={SPRING_SWAP}
                    className="block truncate px-1 text-xs font-bold
                      tracking-wider uppercase"
                  >
                    {monthTitle(month)}
                  </m.span>
                </AnimatePresence>
              </div>
              <m.button
                type="button"
                whileTap={{ scale: 0.85, x: 3 }}
                transition={SPRING_PRESS}
                aria-label="Next month"
                onClick={() => setMonth(shiftMonth(month, 1))}
                className="flex size-9 shrink-0 items-center justify-center
                  rounded-full active:bg-white/15"
              >
                <ChevronRight className="size-5" />
              </m.button>
            </div>
          </div>
          {month !== thisMonth && (
            <button
              type="button"
              onClick={() => setMonth(thisMonth)}
              className="relative z-20 mt-1 text-xs font-bold text-white
                underline underline-offset-2"
            >
              Back to this month
            </button>
          )}

          <div className="relative z-20 mt-4">
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold opacity-80">
                  Planned to release
                </p>
                <p className="text-4xl font-black tracking-tight tabular-nums">
                  {loading ? (
                    <span
                      className="inline-block h-9 w-40 animate-pulse rounded-lg
                        bg-white/20"
                    />
                  ) : (
                    <AnimatedNumber value={total} prefix="₱" duration={700} />
                  )}
                </p>
              </div>
              <div className="relative shrink-0">
                <m.button
                  type="button"
                  whileTap={{ scale: 0.85, rotate: 90 }}
                  transition={SPRING_PRESS}
                  disabled={!releasedId}
                  aria-label="Plan a release on any date"
                  onClick={() => {
                    try {
                      dateInput.current?.showPicker();
                    } catch {
                      dateInput.current?.focus();
                    }
                  }}
                  className="relative flex size-9 items-center justify-center
                    rounded-full bg-white text-emerald-600 shadow-sm
                    disabled:opacity-40"
                >
                  <Plus className="size-5" />
                </m.button>
                <input
                  ref={dateInput}
                  type="date"
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0"
                  onChange={(e) => {
                    addDate(e.target.value);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <p className="mt-0.5 truncate text-xs font-semibold opacity-90">
              {loading
                ? " "
                : all.length === 0
                  ? "Nothing planned yet. Tap + on a day."
                  : `${all.length} release${all.length === 1 ? "" : "s"} · ${created} created${
                      next
                        ? ` · next ${dayParts(next).label.toLowerCase()} ${inDays(today, next)} (${nextCount})`
                        : ""
                    }`}
            </p>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Created"
            >
              {/* A CSS transition: it fills from empty once the month loads,
                and slides on every change, with no frame work of its own. */}
              <div
                className="h-full origin-left rounded-full bg-white
                  transition-transform duration-1000
                  ease-[cubic-bezier(0.34,1.56,0.64,1)]
                  motion-reduce:transition-none"
                style={{ transform: `scaleX(${pct / 100})` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-20 -mt-8 px-3">
        {failed && (
          <p
            className="mb-2 rounded-2xl bg-card p-3 text-center text-sm
              text-destructive shadow-sm"
          >
            Couldn&apos;t load this month. Come back online to retry.
          </p>
        )}
        {!loading && !releasedId && !failed && (
          <p
            className="mb-2 rounded-2xl bg-card p-3 text-center text-sm
              text-muted-foreground shadow-sm"
          >
            The checklist has no &ldquo;released&rdquo; list yet, so there is
            nowhere to plan releases.
          </p>
        )}

        <FilterBar
          value={filter}
          counts={counts}
          disabled={loading}
          onChange={setFilter}
        />

        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <m.div
            key={month}
            initial={{ x: direction * slide, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -slide, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            className="mt-3"
          >
            {/* A fixed grid: tiles keep their rows. When a filter takes some
                away or brings them back, the rest glide to their new cells. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {[
                  ...shown.map(({ date, entries }, i) => ({
                    key: date,
                    node: (
                      <DayCell
                        index={i}
                        date={date}
                        today={today}
                        entries={entries}
                        filter={filter}
                        loading={loading}
                        canAdd={!!releasedId}
                        reduceMotion={!!reduceMotion}
                        onOpen={() =>
                          router.push(
                            `/daily-checklist?date=${date}&tab=release`,
                          )
                        }
                        onAdd={() => open({ kind: "add", date })}
                        onEntry={(id) => open({ kind: "menu", id })}
                        onRemove={
                          extraDates.includes(date) && !isPatternDate(date)
                            ? () => removeDate(date)
                            : undefined
                        }
                      />
                    ),
                  })),
                  ...(releasedId && (filter === "all" || filter === "free")
                    ? [
                        {
                          key: "add-date",
                          node: (
                            <AddDateTile
                              index={shown.length}
                              month={month}
                              reduceMotion={!!reduceMotion}
                              onPick={(date) => addDate(date, false)}
                            />
                          ),
                        },
                      ]
                    : []),
                ].map(({ key, node }) => (
                  <m.div
                    key={key}
                    layout={reduceMotion ? false : "position"}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: 0.85,
                      transition: { duration: reduceMotion ? 0 : 0.18 },
                    }}
                    transition={TILE_SPRING}
                  >
                    {node}
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {!loading && shown.length === 0 && (
                <m.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-6 py-10 text-center text-sm font-semibold
                    text-muted-foreground"
                >
                  {EMPTY_TEXT[filter]}
                </m.p>
              )}
            </AnimatePresence>
          </m.div>
        </AnimatePresence>

        <Link
          href="/daily-checklist?tab=release"
          className="mt-5 flex items-center justify-center gap-1.5 text-xs
            font-semibold text-muted-foreground"
        >
          <ClipboardCheck className="size-3.5" />
          Plans are the release checklist on each day
        </Link>
      </div>

      <Sheet
        open={sheet?.kind === "add"}
        onClose={closeSheet}
        label="Plan a release"
      >
        {sheet?.kind === "add" && (
          <PlanAddSheet
            key={sheet.seq}
            date={sheet.date}
            onAdded={onAdded}
            onClose={closeSheet}
          />
        )}
      </Sheet>
      <Sheet
        open={sheet?.kind === "menu" && !!sheetItem}
        onClose={closeSheet}
        label="Release options"
      >
        {sheet?.kind === "menu" && sheetItem && (
          <PlanMenuSheet
            key={sheet.seq}
            item={sheetItem}
            onEdit={() => open({ kind: "edit", id: sheetItem.id })}
            onMove={(date) => moveTo(sheetItem.id, date)}
            onDelete={() => remove(sheetItem.id)}
          />
        )}
      </Sheet>
      <Sheet
        open={sheet?.kind === "edit" && !!sheetItem}
        onClose={closeSheet}
        label="Edit release"
      >
        {sheet?.kind === "edit" && sheetItem && (
          <ReleaseEditSheet
            key={sheet.seq}
            view={buildReleaseView(sheetItem)}
            disabled={false}
            setLabel={setLabel}
            onOpenBorrower={() => {
              const id = buildReleaseView(sheetItem).borrowerId;
              if (id) router.push(`/borrowers/${id}`);
            }}
            onClose={closeSheet}
          />
        )}
      </Sheet>
    </div>
  );
}

const FILTERS: { value: PlanFilter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "open", label: "not created" },
  { value: "created", label: "created" },
  { value: "free", label: "free" },
];

const EMPTY_TEXT: Record<PlanFilter, string> = {
  all: "No days this month.",
  open: "Every release this month is created.",
  created: "Nothing created this month yet.",
  free: "Every day this month has a release.",
};

/** How tiles glide to a new cell when a filter changes. */
const TILE_SPRING = {
  type: "spring",
  stiffness: 340,
  damping: 32,
  mass: 0.8,
} as const;

/** The filter chips over the tiles; the selected pill slides between them. */
function FilterBar({
  value,
  counts,
  disabled,
  onChange,
}: {
  value: PlanFilter;
  counts: Record<PlanFilter, number>;
  disabled: boolean;
  onChange(next: PlanFilter): void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Show"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-border
        bg-card p-1 shadow-sm [scrollbar-width:none]
        [&::-webkit-scrollbar]:hidden"
    >
      {FILTERS.map((f) => {
        const selected = f.value === value;
        return (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(f.value)}
            className={cn(
              `relative flex shrink-0 grow items-center justify-center gap-1
              rounded-xl px-2.5 py-2 text-xs font-bold whitespace-nowrap
              transition-colors disabled:opacity-60`,
              selected ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {selected && (
              <m.span
                layoutId="plan-filter"
                aria-hidden="true"
                className="absolute inset-0 rounded-xl bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{f.label}</span>
            {!disabled && (
              <span
                className={cn(
                  "relative tabular-nums",
                  selected ? "opacity-80" : "opacity-60",
                )}
              >
                {counts[f.value]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DayCell({
  index,
  date,
  today,
  entries,
  filter,
  loading,
  canAdd,
  reduceMotion,
  onOpen,
  onAdd,
  onEntry,
  onRemove,
}: {
  index: number;
  date: string;
  today: string;
  entries: PlanEntry[];
  /** A filter change swaps the releases shown; that is no new plan. */
  filter: PlanFilter;
  loading: boolean;
  canAdd: boolean;
  reduceMotion: boolean;
  onOpen(): void;
  onAdd(): void;
  onEntry(id: string): void;
  /** A custom day: takes it off the plan while nothing is on it. */
  onRemove?(): void;
}) {
  const { label, weekday } = dayParts(date);
  const isToday = date === today;
  const past = date < today;
  const total = planTotal(entries);
  const allDone = entries.length > 0 && entries.every((e) => e.done);

  // A plan landing on the day gives the card a little hop.
  const cell = useRef<HTMLDivElement>(null);
  // A busy day scrolls inside its tile; the edges fade where more is hidden.
  const list = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const el = list.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setEdges((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
    );
  }, []);
  useEffect(() => {
    measure();
    const el = list.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, entries.length, loading]);
  const count = useRef(entries.length);
  const shownFilter = useRef(filter);
  useEffect(() => {
    const grew =
      entries.length > count.current && shownFilter.current === filter;
    count.current = entries.length;
    shownFilter.current = filter;
    if (!grew || loading || reduceMotion) return;
    cell.current?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.05) rotate(-0.6deg)" },
        { transform: "scale(0.99)" },
        { transform: "scale(1)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [entries.length, filter, loading, reduceMotion]);

  const monthShort = new Date(`${date}T00:00:00Z`)
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 26,
        delay: Math.min(index, 14) * 0.025,
      }}
      className="h-full"
    >
      <div
        ref={cell}
        role="link"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as Element).closest("button, a")) return;
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
        }}
        aria-label={`${label}, open the checklist on this day`}
        className={cn(
          `flex h-full min-h-36 cursor-pointer flex-col rounded-3xl border
          border-border bg-card p-2.5 shadow-sm transition-colors
          active:bg-muted/60`,
          isToday && "border-primary/60 bg-primary/5 ring-1 ring-primary/60",
        )}
      >
        {/* The day: a big number, its month and weekday beside it. */}
        <div className="flex items-start gap-1 px-0.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={cn(
                `text-[28px] leading-none font-black tracking-tight
                tabular-nums`,
                isToday && "text-primary",
              )}
            >
              {Number(date.slice(8))}
            </span>
            <div className="min-w-0 leading-tight">
              <p
                className={cn(
                  `flex items-center gap-1 text-[10px] font-bold tracking-wider
                  text-muted-foreground`,
                  isToday && "text-primary",
                )}
              >
                {monthShort}
                <AnimatePresence>
                  {allDone && (
                    <m.span
                      initial={{ scale: 0, rotate: -60 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 14,
                      }}
                      className="inline-flex size-3.5 items-center
                        justify-center rounded-full bg-primary
                        text-primary-foreground"
                    >
                      <Check
                        className="size-2.5"
                        strokeWidth={4}
                        aria-label="All created"
                      />
                    </m.span>
                  )}
                </AnimatePresence>
              </p>
              <p
                className="flex items-center gap-1 truncate text-[11px]
                  font-semibold text-muted-foreground lowercase"
              >
                {isToday && (
                  <span className="relative flex size-1.5 shrink-0">
                    <span
                      className="absolute inline-flex size-full animate-ping
                        rounded-full bg-primary opacity-75 motion-reduce:hidden"
                    />
                    <span
                      className="relative inline-flex size-1.5 rounded-full
                        bg-primary"
                    />
                  </span>
                )}
                {isToday ? "today" : weekday}
                {onRemove && <span className="text-primary">· custom</span>}
              </p>
            </div>
          </div>
          {canAdd && (
            <m.button
              type="button"
              whileTap={{ scale: 0.8, rotate: 90 }}
              whileHover={{ scale: 1.08 }}
              transition={SPRING_PRESS}
              onClick={onAdd}
              aria-label={`Plan a release on ${label}`}
              className="flex size-8 shrink-0 items-center justify-center
                rounded-full bg-primary text-primary-foreground shadow-sm
                active:opacity-80"
            >
              <Plus className="size-4" strokeWidth={2.75} />
            </m.button>
          )}
        </div>

        {loading ? (
          <div className="mt-2.5 space-y-1.5" aria-hidden="true">
            {Array.from({ length: 1 + (index % 3) }, (_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-2xl bg-muted"
                style={{ animationDelay: `${(index * 3 + i) * 60}ms` }}
              />
            ))}
          </div>
        ) : (
          <>
            <ol
              ref={list}
              onScroll={measure}
              className="-mx-1 mt-2.5 max-h-[11.75rem] space-y-1.5
                overflow-y-auto overscroll-contain px-1 [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden"
              style={{
                maskImage: `linear-gradient(to bottom, ${
                  edges.top ? "transparent, black 18px" : "black, black"
                }, ${
                  edges.bottom
                    ? "black calc(100% - 30px), transparent"
                    : "black"
                })`,
              }}
            >
              <AnimatePresence initial={false}>
                {entries.map((entry) => (
                  <m.li
                    key={entry.id}
                    layout={!reduceMotion}
                    initial={{ opacity: 0, x: -10, scale: 0.9 }}
                    // On a day gone by, created releases dim; one still not
                    // created stays bright, since it still needs doing.
                    animate={{
                      opacity: past && entry.done ? 0.55 : 1,
                      x: 0,
                      scale: 1,
                    }}
                    exit={{ opacity: 0, x: 16, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  >
                    <PlanEntryChip
                      entry={entry}
                      onClick={() => onEntry(entry.id)}
                    />
                  </m.li>
                ))}
              </AnimatePresence>
            </ol>
            {entries.length === 0 && (
              <div
                className="flex flex-1 flex-col items-center justify-center
                  gap-1 py-2"
              >
                <p
                  className="text-[11px] font-semibold text-muted-foreground/60"
                >
                  free day
                </p>
                {onRemove && (
                  <button
                    type="button"
                    onClick={onRemove}
                    className="rounded-full px-2.5 py-1 text-[11px]
                      font-semibold text-muted-foreground active:bg-muted"
                  >
                    Remove date
                  </button>
                )}
              </div>
            )}
            {entries.length > 1 && (
              <div
                className="mt-auto flex items-center justify-between px-1 pt-2
                  text-[11px] font-bold text-muted-foreground tabular-nums"
              >
                <span>{entries.length} releases</span>
                {total > 0 && (
                  <span className="text-foreground">₱{shortAmount(total)}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </m.div>
  );
}

/**
 * One planned release inside a day: a soft card tinted with the borrower's
 * category colour, the name and amount on top, then the kind of account, its
 * term and the category.
 */
function PlanEntryChip({
  entry,
  onClick,
}: {
  entry: PlanEntry;
  onClick(): void;
}) {
  const color = entry.category?.color ?? null;
  const stripe = color
    ? isNearWhite(color)
      ? NEAR_WHITE_BORDER
      : color
    : "var(--border)";
  const cashAdvance = entry.kind === "cash_advance";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${entry.name}${
        entry.amount ? ` ${peso(entry.amount)}` : ""
      }${entry.kind ? `, ${cashAdvance ? "cash advance" : "loan"}` : ""}${
        entry.category ? `, ${entry.category.name}` : ""
      }${entry.done ? ", created" : ""}. Edit or delete`}
      style={{ "--cat": stripe } as React.CSSProperties}
      className={cn(
        `relative w-full overflow-hidden rounded-2xl py-1.5 pr-2 pl-3 text-left
        transition-transform active:scale-[0.97]`,
        color
          ? "bg-[color-mix(in_oklab,var(--cat)_12%,var(--card))]"
          : "bg-muted/60",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1.5 left-1 w-1 rounded-full bg-(--cat)"
      />
      <span className="flex items-baseline gap-1">
        {entry.done && (
          <Check
            className="size-3 shrink-0 self-center text-primary"
            strokeWidth={3.5}
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-bold lowercase",
            entry.done && "text-muted-foreground line-through",
          )}
        >
          {entry.name}
        </span>
        {entry.amount !== null && (
          <span
            className={cn(
              "shrink-0 text-[13px] font-black tabular-nums",
              entry.done && "text-muted-foreground",
            )}
          >
            {shortAmount(entry.amount)}
          </span>
        )}
      </span>
      {(entry.kind || entry.category) && (
        <span className="mt-0.5 flex min-w-0 items-center gap-1">
          {entry.kind && (
            <span
              className={cn(
                `shrink-0 rounded-full px-1.5 py-px text-[9px] font-black
                tracking-wide uppercase`,
                cashAdvance
                  ? `bg-yellow-400/30 text-yellow-800 dark:bg-yellow-400/15
                    dark:text-yellow-300`
                  : "bg-violet-500/15 text-[#7354a0] dark:text-[#d9cfe6]",
              )}
            >
              {cashAdvance ? "c.a." : "loan"}
              {entry.term ? ` · ${entry.term}` : ""}
            </span>
          )}
          {entry.category && (
            <span
              className="min-w-0 truncate text-[10px] font-semibold
                text-muted-foreground lowercase"
            >
              {entry.category.name}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** The last tile: picks any day to plan on, kept on this device. */
function AddDateTile({
  index,
  month,
  reduceMotion,
  onPick,
}: {
  index: number;
  month: MonthKey;
  reduceMotion: boolean;
  onPick(date: string): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { from, to } = monthRange(month);
  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 26,
        delay: Math.min(index, 14) * 0.025,
      }}
      whileTap={{ scale: 0.96 }}
      className="relative h-full"
    >
      <button
        type="button"
        onClick={() => {
          try {
            input.current?.showPicker();
          } catch {
            input.current?.focus();
          }
        }}
        className="flex h-full min-h-32 w-full flex-col items-center
          justify-center gap-1.5 rounded-2xl border-2 border-dashed
          border-primary/30 text-primary active:bg-primary/5"
      >
        <span
          className="flex size-9 items-center justify-center rounded-full
            bg-primary/10"
        >
          <CalendarPlus className="size-4.5" />
        </span>
        <span className="text-xs font-bold lowercase">add a date</span>
      </button>
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-hidden
        min={from}
        max={to}
        defaultValue={from}
        className="pointer-events-none absolute inset-0 opacity-0"
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
      />
    </m.div>
  );
}

/** A plan's options: edit its note, move it to another day, or delete it. */
function PlanMenuSheet({
  item,
  onEdit,
  onMove,
  onDelete,
}: {
  item: DailyChecklistItem;
  onEdit(): void;
  onMove(date: string): void;
  onDelete(): void;
}) {
  const router = useRouter();
  const view = buildReleaseView(item);
  const amount = Number(view.parsed?.initialValues.principal_amount ?? 0);
  const { label, weekday } = dayParts(item.checklist_date);
  const moveInput = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const once = (fn: () => void) => () => {
    if (done.current) return;
    done.current = true;
    fn();
  };

  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="truncate text-lg font-semibold lowercase">
        {view.name || view.typed}
      </h2>
      <p className="text-sm text-muted-foreground">
        {amount > 0 ? `${peso(amount)} · ` : ""}
        {weekday.toLowerCase()}, {label.toLowerCase()}
        {item.is_checked &&
          " · the account is already created; this only changes the plan"}
      </p>
      <ul className="mt-3 space-y-2">
        <MenuEntry
          icon={<Pencil className="size-4" />}
          title="Edit release"
          onClick={onEdit}
        />
        <li className="relative">
          <button
            type="button"
            onClick={() => {
              try {
                moveInput.current?.showPicker();
              } catch {
                moveInput.current?.focus();
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl border
              border-border bg-background p-3 text-left active:bg-muted"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center
                rounded-lg bg-primary/10 text-primary"
            >
              <CalendarArrowUp className="size-4" />
            </span>
            <span className="text-sm font-medium">Move to another date</span>
          </button>
          <input
            ref={moveInput}
            type="date"
            tabIndex={-1}
            aria-hidden
            defaultValue={item.checklist_date}
            className="pointer-events-none absolute inset-0 opacity-0"
            onChange={(e) => {
              if (e.target.value) once(() => onMove(e.target.value))();
            }}
          />
        </li>
        {view.borrowerId && (
          <MenuEntry
            icon={<ExternalLink className="size-4" />}
            title="Open borrower page"
            onClick={() => router.push(`/borrowers/${view.borrowerId}`)}
          />
        )}
        <MenuEntry
          icon={<Trash2 className="size-4" />}
          title="Delete release"
          danger
          onClick={once(onDelete)}
        />
      </ul>
    </div>
  );
}

/**
 * The checklist's own release composer, writing to the chosen day through
 * that day's checklist, so it saves (or queues offline) exactly as adding it
 * on the checklist would.
 */
function PlanAddSheet({
  date,
  onAdded,
  onClose,
}: {
  date: string;
  onAdded(rows: DailyChecklistItem[]): void;
  onClose(): void;
}) {
  const day = useChecklistItems(date);
  const { label } = dayParts(date);
  return (
    <AddSheet
      mode="release"
      date={date}
      heading={`Plan for ${label.toLowerCase()}`}
      api={{
        items: day.items,
        loading: day.loading,
        collectId: day.collectId,
        releasedId: day.releasedId,
        setLabel: day.setLabel,
        addItems: (rows, onOutcome) =>
          day.addItems(rows, onOutcome).then((created) => {
            onAdded(created);
            return created;
          }),
      }}
      onClose={onClose}
    />
  );
}

function PlanSkeleton() {
  return (
    <div className="mx-auto max-w-md pb-32" aria-hidden="true">
      <div className="-mt-16 h-64 rounded-b-3xl bg-(--page-1) sm:mt-0" />
      <div className="relative -mt-8 grid grid-cols-2 gap-2 px-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
