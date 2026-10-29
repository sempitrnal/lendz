"use client";

import { groupColorStyle } from "@/lib/checklist/group-color";
import { useMemo, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import { groupByBorrowerCategory } from "@/lib/checklist/labels";
import {
  matchesFilter,
  matchesSearch,
  sortSettledLast,
  summarizeRows,
  type ChecklistFilter,
} from "@/lib/checklist/list-view";
import type { RowView } from "@/lib/checklist/row-state";
import {
  NEAR_WHITE_BORDER,
  isNearWhite,
} from "@/components/dashboard/checklist/dom";
import { peso } from "@/components/dashboard/checklist-v2/header";
import { CollectRow } from "@/components/dashboard/checklist-v2/collect-row";

/** What a row asks the screen to open; the sheets render from it. */
export type RowRequest =
  | "openPay"
  | "payRow"
  | "editPayments"
  | "partial"
  | "note"
  | "more";

/** The screen's row state and handlers, passed through to every row. */
export type CollectRowsApi = {
  swipedId: string | null;
  onSwiped(itemId: string, open: boolean): void;
  waitingIds: Set<string>;
  flashIds: Set<string>;
  /** `lineId`: the one schedule a pay request is about. */
  onRequest(row: RowView, request: RowRequest, lineId?: string): void;
  onPayAll(row: RowView): void;
  onPayLine(row: RowView, lineId: string): void;
  onTick(row: RowView): void;
  /** Schedules paid on the viewed day; null until known. */
  paidIds: ReadonlySet<string> | null;
};

const CARRY_KEY = "carry";

type Group = {
  key: string;
  name: string;
  color: string | null;
  rows: RowView[];
};

function buildGroups(
  rows: RowView[],
  borrowers: BorrowerSearchItem[],
): Group[] {
  return groupByBorrowerCategory(rows, (r) => r.item.label, borrowers).map(
    (g) => ({ ...g, rows: sortSettledLast(g.rows) }),
  );
}

/**
 * The Collect tab's list: rows grouped by borrower category, then one amber
 * "carried over" section for rows whose every installment is from an earlier
 * day.
 */
export function CollectList({
  rows,
  filter,
  search,
  borrowers,
  isToday,
  api,
  populating,
  onPopulate,
}: {
  /** Every Collect row of the day (unfiltered). */
  rows: RowView[];
  filter: ChecklistFilter;
  /** Typed in the header; rows must match it as well as the filter. */
  search: string;
  borrowers: BorrowerSearchItem[];
  isToday: boolean;
  api: CollectRowsApi;
  /** A populate is under way: the empty list's button waits. */
  populating: boolean;
  /** Populate due, the empty list's big button. */
  onPopulate(): void;
}) {
  // Keys the owner has flipped from their default: carried-over categories
  // start folded, everything else open.
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const foldedByDefault = (key: string) => key.startsWith("c:");
  const toggle = (key: string) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const { todayGroups, carriedGroups, carriedRows } = useMemo(() => {
    const visible = rows.filter(
      (r) => matchesFilter(r, filter) && matchesSearch(r, search),
    );
    const carried = visible.filter((r) => r.carried);
    return {
      todayGroups: buildGroups(
        visible.filter((r) => !r.carried),
        borrowers,
      ),
      carriedGroups: buildGroups(carried, borrowers),
      carriedRows: carried,
    };
  }, [rows, filter, search, borrowers]);
  const searching = search.trim() !== "";
  // A search opens and closes groups on every keystroke: skip the motion.
  const still = useReducedMotion() || searching;
  const fold = { height: 0, opacity: 0 };

  if (rows.length === 0) {
    return (
      <div className="mt-3 px-3">
        <div
          className="rounded-2xl border border-dashed border-border bg-card px-6
            py-10 text-center"
        >
          <p className="text-base font-semibold">
            Nothing on {isToday ? "today's" : "this day's"} list
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pull in everyone who&apos;s due {isToday ? "today" : "this day"} or
            running late.
          </p>
          <Button
            size="lg"
            className="mt-4 h-11 px-6"
            disabled={populating}
            onClick={onPopulate}
          >
            {populating ? "Populating…" : "Populate due"}
          </Button>
        </div>
      </div>
    );
  }

  const renderGroup = (g: Group, section: string) => {
    const key = `${section}:${g.key}`;
    // A search opens every group: a match inside a folded one would hide.
    const isCollapsed = !searching && foldedByDefault(key) !== flipped.has(key);
    const totals = summarizeRows(g.rows);
    return (
      <div
        key={key}
        style={groupColorStyle(g.color)}
        className="border-b border-border last:border-b-0"
      >
        <button
          type="button"
          data-tour="checklist-group"
          onClick={() => toggle(key)}
          aria-expanded={!isCollapsed}
          className={cn(
            // Folded bars are roomy; an open one slims down. The padding
            // eases with the same curve and time as the rows' fold below.
            `flex w-full items-center gap-2 px-4 text-left text-xs font-semibold
            lowercase transition-[padding] duration-[260ms]
            ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none`,
            isCollapsed ? "py-3.5" : "py-1.5",
            g.color
              ? "bg-[color:color-mix(in_oklab,var(--grp)_8%,var(--card))]"
              : "bg-card",
          )}
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{
              backgroundColor: g.color ?? "var(--muted-foreground)",
              opacity: g.color ? 1 : 0.4,
              boxShadow:
                g.color && isNearWhite(g.color)
                  ? `inset 0 0 0 1px ${NEAR_WHITE_BORDER}`
                  : undefined,
            }}
          />
          <span className="truncate font-bold">{g.name}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {totals.done}/{totals.count}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {totals.left > 0 && (
              <span className="tabular-nums">{peso(totals.left)}</span>
            )}
            <ChevronDown
              className={cn(
                `size-3.5 transition-transform duration-[260ms]
                ease-[cubic-bezier(0.32,0.72,0,1)]
                motion-reduce:transition-none`,
                isCollapsed && "-rotate-90",
              )}
            />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <m.div
              key="rows"
              initial={still ? false : fold}
              animate={{ height: "auto", opacity: 1 }}
              exit={still ? undefined : fold}
              transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <ul>
                {g.rows.map((row) => {
                  const id = row.item.id;
                  return (
                    <CollectRow
                      key={id}
                      row={row}
                      waiting={api.waitingIds.has(id)}
                      highlight={api.flashIds.has(id)}
                      swiped={api.swipedId === id}
                      onSwiped={(open) => api.onSwiped(id, open)}
                      onOpenPay={() => api.onRequest(row, "openPay")}
                      onPayRow={() => api.onRequest(row, "payRow")}
                      onOpenLine={(lineId) =>
                        api.onRequest(row, "openPay", lineId)
                      }
                      onMore={() => api.onRequest(row, "more")}
                      onPayAll={() => api.onPayAll(row)}
                      onPayLine={(lineId) => api.onPayLine(row, lineId)}
                      onTick={() => api.onTick(row)}
                      paidIds={api.paidIds}
                    />
                  );
                })}
              </ul>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const carriedTotals = summarizeRows(carriedRows);
  const carryCollapsed = !searching && flipped.has(CARRY_KEY);

  return (
    <div data-settle-group="list" className="mt-3 space-y-3">
      {todayGroups.length > 0 && (
        <section className="overflow-hidden border-y border-border bg-card">
          {todayGroups.map((g) => renderGroup(g, "t"))}
        </section>
      )}
      {carriedGroups.length > 0 && (
        <section className="overflow-hidden border-y border-border bg-card">
          <button
            type="button"
            data-tour="checklist-carried"
            onClick={() => toggle(CARRY_KEY)}
            aria-expanded={!carryCollapsed}
            className="flex w-full items-center gap-2 bg-amber-500/10 px-4
              py-2.5 text-left text-xs font-semibold text-amber-800 lowercase
              dark:bg-amber-500/15 dark:text-amber-300"
          >
            <Undo2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span>carried over</span>
            <span className="tabular-nums">
              {carriedTotals.done}/{carriedTotals.count}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="tabular-nums">{peso(carriedTotals.left)}</span>
              {carryCollapsed ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
            </span>
          </button>
          {!carryCollapsed && (
            <div data-tour="checklist-carried-groups">
              {carriedGroups.map((g) => renderGroup(g, "c"))}
            </div>
          )}
        </section>
      )}
      {todayGroups.length === 0 && carriedGroups.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {searching
            ? `No match for “${search.trim()}”.`
            : "Nothing here. Try another filter."}
        </p>
      )}
    </div>
  );
}
