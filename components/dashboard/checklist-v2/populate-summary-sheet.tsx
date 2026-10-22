"use client";

import { Button } from "@/components/ui/button";
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
  onClose,
}: {
  summary: AutoPopulateSummary;
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

        <Section title="Due today" rows={summary.dueToday} />
        <Section title="Carried over" rows={summary.carried} late />
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
  late,
}: {
  title: string;
  rows: RowView[];
  late?: boolean;
}) {
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
      <ul
        className="mt-1.5 divide-y divide-border rounded-xl border border-border
          bg-background"
      >
        {rows.map((row) => (
          <li
            key={row.item.id}
            className="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate font-medium lowercase">
              {rowName(row)}
            </span>
            {late && row.lateDays > 0 && (
              <span
                className="shrink-0 text-xs text-rose-600 dark:text-rose-400"
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
    </section>
  );
}
