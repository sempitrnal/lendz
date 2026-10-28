"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeDayLabel, shiftDateValue } from "@/lib/checklist/dates";
import type { ChecklistFilter } from "@/lib/checklist/list-view";
import type { ChecklistTab } from "@/lib/checklist/categories";
import {
  releaseHintLines,
  releasedDayText,
} from "@/lib/checklist/release-list";

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

/** "this month", or the month's name when another month's day is showing. */
function monthLabel(value: string, today: string) {
  if (value.slice(0, 7) === today.slice(0, 7)) return "this month";
  const [y, m] = value.split("-").map(Number);
  return `in ${new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  })}`;
}

const FILTERS: [ChecklistFilter, string][] = [
  ["all", "All"],
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["paid", "Paid"],
];

export type HeaderSummary = {
  left: number;
  leftToday: number;
  leftCarried: number;
  /** Profit collected on the day's rows. */
  profit: number;
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
  wide,
  monthProfit,
  dayProfit,
  releaseProgress,
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
  /** Opens the add sheet for a tab. Off while the day loads. */
  onAdd(tab: ChecklistTab): void;
  /** Opens the Collect list menu ("⋯"). Off while the day loads. */
  onMenu(): void;
  /** Desktop width: both lists show side by side, with no tab switch. */
  wide: boolean;
  /** Profit collected over the viewed day's month; null while it loads. */
  monthProfit: number | null;
  /** Profit from the payments made on this day; null until it loads. */
  dayProfit: number | null;
  /** Releases created so far, of the day's parsed ones. */
  releaseProgress: { created: number; total: number };
}) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const relative = relativeDayLabel(date, today);
  const progress =
    summary.due > 0
      ? Math.min(100, (summary.collected / summary.due) * 100)
      : 0;

  const releasePercent =
    releaseProgress.total > 0
      ? Math.round((releaseProgress.created / releaseProgress.total) * 100)
      : 0;
  const showCollect = wide || tab === "collect";
  const showRelease = wide || tab === "release";

  const menuButton = (
    <button
      type="button"
      data-tour="checklist-menu"
      onClick={onMenu}
      disabled={loading}
      aria-label={`${date === today ? "Today's" : "This day's"} list options`}
      className="relative flex size-9 shrink-0 items-center justify-center
        rounded-full border border-border bg-card after:absolute
        after:-inset-[5px] after:content-[''] text-muted-foreground
        transition-opacity active:scale-95 disabled:opacity-40"
    >
      <MoreHorizontal className="size-5" />
    </button>
  );
  const addButton = (kind: ChecklistTab) => (
    <button
      type="button"
      data-tour="checklist-add"
      onClick={() => onAdd(kind)}
      // Writes made before the day has loaded wouldn't show.
      disabled={loading}
      aria-label={kind === "release" ? "Add a release" : "Add an item"}
      className="relative flex size-9 shrink-0 items-center justify-center
        rounded-full bg-primary text-primary-foreground shadow-sm after:absolute
        after:-inset-1 after:content-[''] transition-opacity active:scale-95
        disabled:opacity-40"
    >
      <Plus className="size-5" />
    </button>
  );

  const filterChips = (
    <div
      data-tour="checklist-filters"
      className={cn("flex gap-2 overflow-x-auto", !wide && "-mx-4 px-4")}
    >
      {FILTERS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={filter === key}
          onClick={() => onFilterChange(key)}
          className={cn(
            `shrink-0 rounded-full border px-2 py-1 text-xs lowercase
            font-semibold transition-colors active:scale-95`,
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
  );

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
      <div className={cn("pt-3", !wide && "px-4")}>
        <div
          className={cn("flex items-center justify-between", wide && "px-4")}
        >
          <div
            data-tour="checklist-date"
            className="relative flex min-w-0 items-center gap-0.5"
          >
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => onDateChange(shiftDateValue(date, -1))}
              className="-ml-2 flex size-9 shrink-0 items-center justify-center
                rounded-full text-muted-foreground active:bg-muted"
            >
              <ChevronLeft className="size-5" />
            </button>
            {/* The real date input sits invisibly over the label, so a tap
                lands on it: the phone's own picker opens on every browser
                (a script can't open one from a 1px hidden input on iOS). The
                button underneath is for keyboards and screen readers. */}
            <div className="relative min-w-0">
              <button
                type="button"
                aria-label={`${headerDate(date, today)}${
                  relative ? ` (${relative})` : ""
                }, pick a date`}
                onClick={openDatePicker}
                className="flex min-w-0 items-center gap-1.5 rounded-lg px-1
                  py-1"
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
                // Desktop browsers only open the picker from the icon; ask.
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch {
                    // Already open, or not supported: the tap did its job.
                  }
                }}
                tabIndex={-1}
                aria-hidden
                className="absolute inset-0 h-full w-full cursor-pointer
                  opacity-0"
              />
            </div>
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
              its 1px border, hence 5px). Side by side, each list has its own
              beside its title. */}
          {!wide && (
            <div className="flex shrink-0 items-center gap-2">
              {tab === "collect" && menuButton}
              {addButton(tab)}
            </div>
          )}
        </div>

        {date !== today && (
          <button
            type="button"
            onClick={() => onDateChange(today)}
            className={cn(
              "mt-1 text-xs font-semibold text-primary",
              wide && "mx-4",
            )}
          >
            Back to today
          </button>
        )}

        <div
          className={cn(
            wide && "grid grid-cols-2 divide-x divide-border [&>*]:px-4",
          )}
        >
          {showCollect && (
            <div className="mt-2" data-tour="checklist-summary">
              {loading ? (
                <div className="flex items-center gap-2" aria-busy="true">
                  <span className="sr-only">Loading the day</span>
                  <span
                    className="h-9 w-32 animate-pulse rounded-lg bg-muted"
                    aria-hidden="true"
                  />
                  <span
                    className="ml-auto h-4 w-16 animate-pulse rounded
                      bg-muted/70"
                    aria-hidden="true"
                  />
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-3xl font-semibold tracking-tight
                      tabular-nums"
                  >
                    {peso(summary.left)}
                  </span>
                  <span className="text-sm text-muted-foreground">left</span>
                  <span
                    className="ml-auto text-sm text-muted-foreground
                      tabular-nums"
                  >
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
              {/* Due today and carried over, apart. The Release block below keeps
                a blank line of the same height so switching tabs doesn't move. */}
              <div
                className="mt-1 flex h-4 items-center gap-3 text-xs tabular-nums
                  text-muted-foreground"
              >
                {loading ? (
                  <span
                    className="h-3 w-40 animate-pulse rounded bg-muted/70"
                    aria-hidden="true"
                  />
                ) : (
                  <div className="font-medium flex gap-2">
                    <span>
                      <span className="font-semibold">
                        {peso(summary.leftToday)}
                      </span>{" "}
                      {date === today ? "due today" : "due this day"}
                    </span>
                    {summary.leftCarried > 0 && (
                      <span className="text-amber-700 dark:text-amber-400">
                        <span className="font-semibold">
                          {peso(summary.leftCarried)}
                        </span>{" "}
                        carried over
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div
                className="mt-0.5 flex h-4 items-center text-xs tabular-nums
                  text-muted-foreground"
              >
                {loading ? (
                  <span
                    className="h-3 w-28 animate-pulse rounded bg-muted/70"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="flex gap-3 font-semibold text-emerald-700
                      dark:text-emerald-400"
                  >
                    <span>
                      <span className="font-black">
                        {peso(dayProfit ?? summary.profit)}
                      </span>{" "}
                      profit collected
                    </span>
                    {monthProfit !== null && (
                      <span>
                        <span className="font-extrabold">
                          {peso(monthProfit)}
                        </span>{" "}
                        {monthLabel(date, today)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
          {showRelease && (
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
                    className="text-3xl font-semibold tracking-tight
                      tabular-nums"
                  >
                    {peso(releaseTotal)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {releasedDayText(date === today)}
                  </span>
                  {releaseProgress.total > 0 && (
                    <span
                      className="ml-auto text-sm text-muted-foreground
                        tabular-nums"
                    >
                      {releaseProgress.created}/{releaseProgress.total} created
                    </span>
                  )}
                </div>
              )}
              {/* Two lines, the height of Collect's breakdown and profit lines, so
                switching tabs doesn't move the list. */}
              <p
                className="mt-1 h-4 truncate text-xs font-semibold
                  text-muted-foreground"
              >
                {!loading && releaseHintLines(releaseCount, date === today)[0]}
              </p>
              <p
                className="mt-0.5 h-4 truncate text-xs font-semibold
                  text-muted-foreground"
              >
                {!loading && releaseHintLines(releaseCount, date === today)[1]}
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-label="Created"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={loading ? undefined : releasePercent}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all
                    duration-500"
                  style={{ width: `${releasePercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticks under the mobile top bar (4rem) or the site header (66px). */}
      {wide ? (
        <div
          className="sticky top-16 z-20 sm:top-[66px] mt-3 grid grid-cols-2
            divide-x divide-border border-b border-border bg-background
            [&>*]:px-4 [&>*]:py-2.5"
        >
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold">
                {loading ? "Collect" : `Collect ${collectCount}`}
              </span>
              <div className="flex items-center gap-2">
                {menuButton}
                {addButton("collect")}
              </div>
            </div>
            {filterChips}
          </div>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <span className="py-2 text-sm font-semibold">
              {loading ? "Release" : `Release ${releaseCount}`}
            </span>
            {addButton("release")}
          </div>
        </div>
      ) : (
        <div
          className="sticky top-16 z-20 sm:top-[66px] mt-3 space-y-2 border-b
            border-border bg-background px-4 pt-2 pb-2.5"
        >
          <div
            className="relative flex rounded-xl bg-secondary p-0.5 text-sm
              font-semibold"
            role="tablist"
            data-tour="checklist-tabs"
          >
            {/* The white pill slides to the tab you pick. It moves only when
                the tab changes: a layout animation would also play whenever
                the header above it changes height (switching the date). */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)]
                rounded-[10px] bg-card shadow-sm transition-transform
                duration-200 ease-out motion-reduce:transition-none"
              style={{
                transform: tab === "release" ? "translateX(100%)" : "none",
              }}
            />
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
                data-tour={`checklist-${key}-tab`}
                aria-selected={tab === key}
                onClick={() => onTabChange(key)}
                className={cn(
                  "relative flex-1 rounded-[10px] py-1.5 transition-colors",
                  tab === key ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
          {tab === "collect" && filterChips}
        </div>
      )}
    </>
  );
}
