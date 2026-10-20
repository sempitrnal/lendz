"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  NotebookPen,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import {
  formatShortDate,
  groupByBorrowerCategory,
} from "@/lib/checklist/labels";
import {
  matchesFilter,
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

const kindLabel = (type: string) =>
  type === "cash_advance" ? "cash advance" : "loan";

/** The muted second line of a collection row, per the spec's row table. */
function subline(row: RowView): { text: string; late: boolean } {
  if (row.status === "paid") return { text: "paid · tap to edit", late: false };
  const open = row.lines.filter((l) => l.state !== "paid");
  if (open.length > 1) {
    return {
      text: `${open.length} due${
        row.lateDays > 0 ? ` · oldest ${row.lateDays}d late` : ""
      }`,
      late: row.lateDays > 0,
    };
  }
  const line = open[0];
  const paid = line.paid > 0 ? `${peso(line.paid)} paid · ` : "";
  const due = formatShortDate(line.due_date).toLowerCase();
  const late = line.overdue ? ` · ${line.daysOverdue}d late` : "";
  return {
    text: `${paid}${due}${late} · ${kindLabel(line.type)}`,
    late: line.overdue,
  };
}

/** A plain note's text, with `[name](href)` mentions shown as their name. */
function plainText(label: string) {
  return label
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, name: string, href: string) =>
      href.startsWith("/borrowers/") ? name.toLowerCase() : name,
    )
    .trim();
}

function CollectionRow({ row }: { row: RowView }) {
  const done = row.status === "paid";
  const open = row.lines.filter((l) => l.state !== "paid");
  const sub = subline(row);
  const name =
    row.model?.borrower?.name.toLowerCase() ||
    row.model?.note.split("\n")[0] ||
    "collection";
  return (
    <li className="border-b border-border bg-card last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-2">
        <div className={cn("min-w-0 flex-1", done && "opacity-55")}>
          <p
            className={cn(
              "truncate text-[15px] font-medium lowercase",
              done && "line-through",
            )}
          >
            {name}
            {row.model?.note && (
              <NotebookPen
                className="ml-1.5 inline size-3.5 text-amber-500"
                aria-label="Has a note"
              />
            )}
          </p>
          <p
            className={cn(
              "truncate text-xs",
              sub.late
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground",
            )}
          >
            {sub.text}
          </p>
        </div>
        <span
          className={cn(
            "text-[15px] font-semibold tabular-nums",
            done && "text-muted-foreground opacity-55",
          )}
        >
          {peso(done ? row.total : row.left)}
        </span>
        {/* Pay controls are shown but not wired yet (read-only list). */}
        {done ? (
          <span
            className="-mr-1 flex size-11 items-center justify-center"
            aria-hidden="true"
          >
            <span
              className="flex size-8 items-center justify-center rounded-full
                bg-primary text-primary-foreground"
            >
              <Check className="size-4" strokeWidth={3} />
            </span>
          </span>
        ) : open.length > 1 ? (
          <span
            className="flex h-9 items-center rounded-full border
              border-muted-foreground/40 px-3 text-sm font-semibold"
            aria-hidden="true"
          >
            Pay {open.length}
          </span>
        ) : (
          <span
            className="-mr-1 flex size-11 items-center justify-center"
            aria-hidden="true"
          >
            <span
              className={cn(
                `flex size-8 items-center justify-center rounded-full border
                  text-muted-foreground`,
                row.status === "partial"
                  ? "border-primary/50 text-primary"
                  : "border-muted-foreground/40",
              )}
            >
              <Check className="size-4" strokeWidth={2.5} />
            </span>
          </span>
        )}
      </div>
    </li>
  );
}

function NoteRow({ row }: { row: RowView }) {
  const done = row.item.is_checked;
  return (
    <li className="border-b border-border bg-card last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40",
          )}
          aria-hidden="true"
        >
          {done && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <p
          className={cn(
            "line-clamp-2 min-w-0 flex-1 text-sm whitespace-pre-line",
            done && "text-muted-foreground line-through",
          )}
        >
          {plainText(row.item.label)}
        </p>
      </div>
    </li>
  );
}

/**
 * The Collect tab's list: rows grouped by borrower category, then one amber
 * "carried over" section for rows whose every installment is from an earlier
 * day. Read-only for now; the row actions come with the row component.
 */
export function CollectList({
  rows,
  filter,
  borrowers,
  isToday,
}: {
  /** Every Collect row of the day (unfiltered). */
  rows: RowView[];
  filter: ChecklistFilter;
  borrowers: BorrowerSearchItem[];
  isToday: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const { todayGroups, carriedGroups, carriedRows } = useMemo(() => {
    const visible = rows.filter((r) => matchesFilter(r, filter));
    const carried = visible.filter((r) => r.carried);
    return {
      todayGroups: buildGroups(
        visible.filter((r) => !r.carried),
        borrowers,
      ),
      carriedGroups: buildGroups(carried, borrowers),
      carriedRows: carried,
    };
  }, [rows, filter, borrowers]);

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
        </div>
      </div>
    );
  }

  const renderGroup = (g: Group, section: string) => {
    const key = `${section}:${g.key}`;
    const isCollapsed = collapsed.has(key);
    const totals = summarizeRows(g.rows);
    return (
      <div
        key={key}
        style={g.color ? ({ "--grp": g.color } as CSSProperties) : undefined}
        className="border-b border-border last:border-b-0"
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          aria-expanded={!isCollapsed}
          className={cn(
            `flex w-full items-center gap-2 px-4 py-2 text-left text-xs
            font-semibold lowercase`,
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
          <span className="truncate">{g.name}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {totals.done}/{totals.count}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {totals.left > 0 && (
              <span className="tabular-nums">{peso(totals.left)}</span>
            )}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                isCollapsed && "-rotate-90",
              )}
            />
          </span>
        </button>
        {!isCollapsed && (
          <ul>
            {g.rows.map((row) =>
              row.model ? (
                <CollectionRow key={row.item.id} row={row} />
              ) : (
                <NoteRow key={row.item.id} row={row} />
              ),
            )}
          </ul>
        )}
      </div>
    );
  };

  const carriedTotals = summarizeRows(carriedRows);
  const carryCollapsed = collapsed.has(CARRY_KEY);

  return (
    <div className="mt-3 space-y-3 px-3">
      {todayGroups.length > 0 && (
        <section
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          {todayGroups.map((g) => renderGroup(g, "t"))}
        </section>
      )}
      {carriedGroups.length > 0 && (
        <section
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <button
            type="button"
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
          {!carryCollapsed && carriedGroups.map((g) => renderGroup(g, "c"))}
        </section>
      )}
      {todayGroups.length === 0 && carriedGroups.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nothing here. Try another filter.
        </p>
      )}
    </div>
  );
}
