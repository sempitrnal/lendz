"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { CalendarArrowUp, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import {
  compactAmount,
  monthGrid,
  shiftMonth,
} from "@/lib/dashboard/daily-profit";
import { resolveCategoryIds } from "@/lib/checklist/categories";
import { fetchChecklistCategories } from "@/lib/checklist/offline-cache";
import {
  monthRange,
  planEntries,
  planTotal,
  type PlanEntry,
} from "@/lib/checklist/release-plan";
import type { DailyChecklistItem } from "@/lib/checklist/types";
import { formatPeso } from "@/lib/dashboard-data";
import { HIDDEN_AMOUNT } from "@/lib/hide-amounts";

/**
 * The dashboard's release calendar, laid out like the profit calendar: a
 * month of days shaded by how much is planned to go out that day, arrows to
 * change month, and a tapped day's releases underneath.
 */

export const RELEASE_CALENDAR_KEY = ["dashboard-release-calendar"];

const WEEKDAYS = ["s", "m", "t", "w", "t", "f", "s"];

/** Cell shading from a small day to the month's biggest, lightest first. */
const HEAT = [
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/35 dark:text-emerald-100",
  "bg-emerald-300 text-emerald-950 dark:bg-emerald-500/55 dark:text-white",
];

const manilaToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

function monthLabel(month: string) {
  const [y, mo] = month.split("-").map(Number);
  return new Date(y, mo - 1, 1)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toLowerCase();
}

function dayLabel(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d)
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toLowerCase();
}

async function loadMonth(month: string): Promise<[string, PlanEntry[]][]> {
  const { categories, error: catError } = await fetchChecklistCategories();
  if (catError) throw new Error("categories");
  const { releasedId } = resolveCategoryIds(categories);
  if (!releasedId) return [];
  const { from, to } = monthRange(month);
  const { data, error } = await supabase
    .from("daily_checklist_items")
    .select(
      "id, checklist_date, label, is_checked, sort_order, created_at, category_id",
    )
    .eq("category_id", releasedId)
    .gte("checklist_date", from)
    .lte("checklist_date", to);
  if (error) throw new Error(error.message);
  const items = (
    (data ?? []) as Omit<DailyChecklistItem, "daily_checklist_categories">[]
  ).map((row) => ({ ...row, daily_checklist_categories: null }));
  return [...planEntries(items, releasedId).entries()];
}

export function ReleaseCalendar({ hide }: { hide: boolean }) {
  const today = manilaToday();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [direction, setDirection] = useState(1);
  const [picked, setPicked] = useState<string | null>(today);

  const queryClient = useQueryClient();
  const monthQuery = (mo: string) => ({
    queryKey: [...RELEASE_CALENDAR_KEY, mo],
    queryFn: () => loadMonth(mo),
    staleTime: 5 * 60_000,
  });
  const { data, isPending, isError } = useQuery(monthQuery(month));

  // The neighbouring months, so the arrows land on a month already loaded.
  useEffect(() => {
    if (isPending) return;
    void queryClient.prefetchQuery(monthQuery(shiftMonth(month, -1)));
    void queryClient.prefetchQuery(monthQuery(shiftMonth(month, 1)));
  }, [month, isPending, queryClient]);

  const byDate = new Map(data ?? []);
  const all = [...byDate.values()].flat();
  const total = planTotal(all);
  const open = all.filter((e) => !e.done).length;
  const sums = [...byDate.values()].map(planTotal);
  const max = Math.max(0, ...sums);
  const planDays = sums.filter((n) => n > 0).length;

  const move = (by: number) => {
    const next = shiftMonth(month, by);
    setDirection(by);
    setMonth(next);
    setPicked(next === thisMonth ? today : null);
  };

  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  const pickedEntries = picked ? (byDate.get(picked) ?? []) : [];

  return (
    <section
      aria-label="Release calendar"
      className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1
        ring-black/5 lowercase dark:ring-white/10"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center
            rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20
            dark:text-emerald-300"
        >
          <CalendarArrowUp className="size-4" aria-hidden="true" />
        </span>
        <h2
          className="text-sm font-black whitespace-nowrap
            text-card-foreground/80"
        >
          release calendar
        </h2>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => move(-1)}
            className="flex size-8 items-center justify-center rounded-full
              text-muted-foreground active:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            className="min-w-[4.5rem] text-center text-xs font-bold
              text-card-foreground/80"
          >
            {monthLabel(month)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => move(1)}
            className="flex size-8 items-center justify-center rounded-full
              text-muted-foreground active:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p
          className={cn(
            `text-2xl font-bold tracking-tight text-card-foreground/80
            tabular-nums`,
            isPending && "opacity-40",
          )}
        >
          {mask(formatPeso(total))}
        </p>
        <p className="text-xs font-semibold text-muted-foreground">
          planned to release
          {isPending
            ? ""
            : ` · ${all.length} release${all.length === 1 ? "" : "s"} · ${planDays} day${
                planDays === 1 ? "" : "s"
              }${open > 0 ? ` · ${open} to create` : ""}`}
        </p>
      </div>

      <div className="px-3 pb-3">
        <div
          className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px]
            font-bold text-muted-foreground"
          aria-hidden="true"
        >
          {WEEKDAYS.map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>

        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <m.div
            key={month}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
              shown: { x: 0, opacity: 1 },
              exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="shown"
            exit="exit"
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="space-y-1"
          >
            {monthGrid(month).map((week, w) => (
              <div key={w} className="grid grid-cols-7 gap-1">
                {week.map((date, d) => {
                  if (!date) return <span key={d} />;
                  const entries = byDate.get(date) ?? [];
                  const sum = planTotal(entries);
                  const level =
                    sum > 0 && max > 0
                      ? Math.min(3, Math.floor((sum / max) * 4))
                      : entries.length > 0
                        ? 0
                        : -1;
                  const undone = entries.some((e) => !e.done);
                  const on = picked === date;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${dayLabel(date)}, ${entries.length} release${
                        entries.length === 1 ? "" : "s"
                      }`}
                      onClick={() => setPicked(date)}
                      className={cn(
                        `relative flex h-12 flex-col items-center justify-center
                        rounded-xl transition-transform active:scale-90`,
                        level >= 0
                          ? HEAT[level]
                          : "bg-muted/40 text-muted-foreground",
                        on &&
                          `ring-2 ring-emerald-500 ring-offset-1
                          ring-offset-card`,
                      )}
                    >
                      {undone && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 size-1.5
                            rounded-full bg-amber-500"
                        />
                      )}
                      <span
                        className={cn(
                          "text-[10px] leading-none font-bold opacity-70",
                          date === today &&
                            `rounded-full bg-emerald-600 px-1.5 py-0.5
                            text-white opacity-100`,
                        )}
                      >
                        {Number(date.slice(8))}
                      </span>
                      <span
                        className="mt-1 text-[11px] leading-none font-black
                          tabular-nums"
                      >
                        {sum > 0 ? (hide ? "•••" : compactAmount(sum)) : "–"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </m.div>
        </AnimatePresence>

        {isError && !data && (
          <p className="pt-2 text-center text-xs font-semibold text-rose-500">
            couldn&apos;t load this month. try again when online.
          </p>
        )}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {picked && (
          <m.div
            key={picked}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-between gap-3 border-t
              border-border bg-muted/30 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-card-foreground/80">
                {dayLabel(picked)}
              </p>
              <p
                className="truncate text-xs font-semibold text-muted-foreground"
              >
                {pickedEntries.length > 0
                  ? `${pickedEntries.length} release${
                      pickedEntries.length === 1 ? "" : "s"
                    } · ${pickedEntries.map((e) => e.name).join(", ")}`
                  : "nothing planned"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <p
                className="text-lg font-bold text-emerald-600 tabular-nums
                  dark:text-emerald-300"
              >
                {mask(formatPeso(planTotal(pickedEntries)))}
              </p>
              <Link
                href={`/releases?date=${picked}`}
                className="flex items-center text-[11px] font-bold
                  text-emerald-700 active:opacity-60 dark:text-emerald-300"
              >
                open plan
                <ChevronRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
