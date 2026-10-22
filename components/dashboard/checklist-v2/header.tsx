"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeDayLabel, shiftDateValue } from "@/lib/checklist/dates";
import type { ChecklistFilter } from "@/lib/checklist/list-view";
import type { ChecklistTab } from "@/lib/checklist/categories";
import { releasedDayText } from "@/lib/checklist/release-list";

export const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** e.g. "Mon, Oct 19" (shown uppercase); adds the year when it isn't the current one. */
function headerDate(value: string, today: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
  });
}

const FILTERS: [ChecklistFilter, string][] = [
  ["all", "All"],
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["paid", "Paid"],
];

export type HeaderSummary = {
  left: number;
  due: number;
  collected: number;
  done: number;
  count: number;
};

/**
 * The top of the checklist: the date row, the day's total and the sticky
 * Collect / Release switch with the filter chips.
 */
export function Header({
  date,
  today,
  onDateChange,
  tab,
  onTabChange,
  collectCount,
  releaseCount,
  summary,
  releaseTotal,
  filter,
  onFilterChange,
  counts,
  loading,
  onAdd,
  onMenu,
}: {
  date: string;
  today: string;
  onDateChange(date: string): void;
  tab: ChecklistTab;
  onTabChange(tab: ChecklistTab): void;
  collectCount: number;
  releaseCount: number;
  summary: HeaderSummary;
  /** The Release tab's total: the day's parsed principals. */
  releaseTotal: number;
  filter: ChecklistFilter;
  onFilterChange(filter: ChecklistFilter): void;
  counts: Record<ChecklistFilter, number>;
  /** The day is still loading: show placeholders, not zeros. */
  loading: boolean;
  /** Opens the add sheet for the current tab. Off while the day loads. */
  onAdd(): void;
  /** Opens the Collect list menu ("⋯"). Off while the day loads. */
  onMenu(): void;
}) {
  const reduceMotion = useReducedMotion();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const relative = relativeDayLabel(date, today);
  const progress =
    summary.due > 0
      ? Math.min(100, (summary.collected / summary.due) * 100)
      : 0;

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  return (
    <>
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="relative flex min-w-0 items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => onDateChange(shiftDateValue(date, -1))}
              className="-ml-2 flex size-9 shrink-0 items-center justify-center
                rounded-full text-muted-foreground active:bg-muted"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={`${headerDate(date, today)}${
                relative ? ` (${relative})` : ""
              }, pick a date`}
              onClick={openDatePicker}
              className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1"
            >
              <span
                className="truncate text-xs font-semibold tracking-wider
                  text-muted-foreground uppercase"
              >
                {headerDate(date, today)}
              </span>
              {relative && (
                <span
                  className="shrink-0 rounded-full bg-muted px-2 py-0.5
                    text-[11px] font-semibold text-muted-foreground"
                >
                  {relative}
                </span>
              )}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) onDateChange(e.target.value);
              }}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-8 size-px
                opacity-0"
            />
            <button
              type="button"
              aria-label="Next day"
              onClick={() => onDateChange(shiftDateValue(date, 1))}
              className="flex size-9 shrink-0 items-center justify-center
                rounded-full text-muted-foreground active:bg-muted"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
          {/* 36px buttons with 44px tap areas (4px around each border box,
              meeting in the 8px gap; the bordered one measures from inside
              its 1px border, hence 5px). */}
          <div className="flex shrink-0 items-center gap-2">
            {tab === "collect" && (
              <button
                type="button"
                onClick={onMenu}
                disabled={loading}
                aria-label={`${
                  date === today ? "Today's" : "This day's"
                } list options`}
                className="relative flex size-9 shrink-0 items-center
                  justify-center rounded-full border border-border bg-card
                  after:absolute after:-inset-[5px] after:content-['']
                  text-muted-foreground transition-opacity active:scale-95
                  disabled:opacity-40"
              >
                <MoreHorizontal className="size-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onAdd}
              // Writes made before the day has loaded wouldn't show.
              disabled={loading}
              aria-label={tab === "release" ? "Add a release" : "Add an item"}
              className="relative flex size-9 shrink-0 items-center
                justify-center rounded-full bg-primary text-primary-foreground
                shadow-sm after:absolute after:-inset-1 after:content-['']
                transition-opacity active:scale-95 disabled:opacity-40"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>

        {date !== today && (
          <button
            type="button"
            onClick={() => onDateChange(today)}
            className="mt-1 text-xs font-semibold text-primary"
          >
            Back to today
          </button>
        )}

        {tab === "release" && (
          // Same height as the Collect block (the figure, then the progress
          // bar's row), so switching tabs doesn't move the list.
          <div className="mt-2">
            {loading ? (
              <div className="flex items-center gap-2" aria-busy="true">
                <span className="sr-only">Loading the day</span>
                <span
                  className="h-9 w-32 animate-pulse rounded-lg bg-muted"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-semibold tracking-tight tabular-nums"
                >
                  {peso(releaseTotal)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {releasedDayText(date === today)}
                </span>
              </div>
            )}
            <div className="mt-2 h-1.5" aria-hidden="true" />
          </div>
        )}

        {tab === "collect" && (
          <div className="mt-2">
            {loading ? (
              <div className="flex items-center gap-2" aria-busy="true">
                <span className="sr-only">Loading the day</span>
                <span
                  className="h-9 w-32 animate-pulse rounded-lg bg-muted"
                  aria-hidden="true"
                />
                <span
                  className="ml-auto h-4 w-16 animate-pulse rounded bg-muted/70"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-semibold tracking-tight tabular-nums"
                >
                  {peso(summary.left)}
                </span>
                <span className="text-sm text-muted-foreground">left</span>
                <span className="ml-auto text-sm text-muted-foreground
                  tabular-nums">
                  {summary.done}/{summary.count} paid
                </span>
              </div>
            )}
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Collected"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loading ? undefined : Math.round(progress)}
            >
              <div
                className="h-full rounded-full bg-primary transition-all
                  duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticks under the mobile top bar (4rem) or the site header (66px). */}
      <div
        className="sticky top-16 z-20 sm:top-[66px] mt-3 space-y-2 border-b
          border-border bg-background/95 px-4 pt-2 pb-2.5 backdrop-blur"
      >
        <div
          className="flex rounded-xl bg-secondary p-0.5 text-sm font-medium"
          role="tablist"
        >
          {(
            [
              ["collect", loading ? "Collect" : `Collect ${collectCount}`],
              ["release", loading ? "Release" : `Release ${releaseCount}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => onTabChange(key)}
              className={cn(
                "relative flex-1 rounded-[10px] py-1.5 transition-colors",
                tab === key ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab === key && (
                // The white pill slides to the tab you pick.
                <motion.span
                  layoutId="checklist-tab-pill"
                  className="absolute inset-0 rounded-[10px] bg-card shadow-sm"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 40 }
                  }
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        {tab === "collect" && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => onFilterChange(key)}
                className={cn(
                  `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium
                  transition-colors active:scale-95`,
                  filter === key
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {label}
                {!loading && ` ${counts[key]}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
