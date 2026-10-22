"use client";

import { useMemo, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import { groupByBorrowerCategory } from "@/lib/checklist/labels";
import {
  NEAR_WHITE_BORDER,
  isNearWhite,
} from "@/components/dashboard/checklist/dom";
import type { AutoPopulateSummary } from "@/lib/checklist/populate-summary";
import type { RowView } from "@/lib/checklist/row-state";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import { peso } from "@/components/dashboard/checklist-v2/header";
import { autoPopulateLabel } from "@/lib/checklist/populate-summary";
import { rowName } from "@/components/dashboard/checklist-v2/collect-row";

/**
 * The morning summary: what the morning run added to today's list, split into
 * due today and carried over. Render it inside `Sheet`.
 */
export function PopulateSummarySheet({
  summary,
  borrowers,
  onClose,
}: {
  summary: AutoPopulateSummary;
  /** To find each borrower's category. */
  borrowers: BorrowerSearchItem[];
  onClose(): void;
}) {
  return (
    <>
      <div className="px-5 pt-2 pb-3">
        <p className="text-xs font-medium text-muted-foreground">
          {autoPopulateLabel()} update
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          {`${summary.added} added to today's list`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {peso(summary.left)} to collect
        </p>

        <Section
          title="Due today"
          rows={summary.dueToday}
          borrowers={borrowers}
        />
        <Section
          title="Carried over"
          rows={summary.carried}
          borrowers={borrowers}
          late
        />
      </div>
      <SheetFooter>
        <Button size="lg" className="h-12 w-full text-base" onClick={onClose}>
          Got it
        </Button>
      </SheetFooter>
    </>
  );
}

function Section({
  title,
  rows,
  borrowers,
  late,
}: {
  title: string;
  rows: RowView[];
  borrowers: BorrowerSearchItem[];
  late?: boolean;
}) {
  // Grouped by the borrower's category, like the list itself.
  const groups = useMemo(
    () => groupByBorrowerCategory(rows, (r) => r.item.label, borrowers),
    [rows, borrowers],
  );
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.left, 0);
  return (
    <section className="mt-4">
      <div
        className="flex items-baseline justify-between text-xs font-semibold
          lowercase"
      >
        <h3>
          {title} · {rows.length}
        </h3>
        <span className="tabular-nums text-muted-foreground">
          {peso(total)}
        </span>
      </div>
      <div
        className="mt-1.5 overflow-hidden rounded-xl border border-border
          bg-background"
      >
        {groups.map((g) => (
          <div
            key={g.key}
            style={
              g.color ? ({ "--grp": g.color } as CSSProperties) : undefined
            }
            className="border-b border-border last:border-b-0"
          >
            <div
              className={`flex items-center gap-2 px-3 py-1.5 text-[11px]
              font-semibold lowercase ${
                g.color
                  ? "bg-[color:color-mix(in_oklab,var(--grp)_8%,var(--card))]"
                  : "bg-card"
              }`}
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
              <span className="truncate">{g.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {g.rows.length}
              </span>
              <span
                className="ml-auto shrink-0 tabular-nums text-muted-foreground"
              >
                {peso(g.rows.reduce((sum, r) => sum + r.left, 0))}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {g.rows.map((row) => (
                <li
                  key={row.item.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span
                    className="min-w-0 flex-1 truncate font-medium lowercase"
                  >
                    {rowName(row)}
                  </span>
                  {late && row.lateDays > 0 && (
                    <span
                      className="shrink-0 text-xs text-rose-600
                        dark:text-rose-400"
                    >
                      {row.lateDays}d late
                    </span>
                  )}
                  <span className="shrink-0 font-semibold tabular-nums">
                    {peso(row.left)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
