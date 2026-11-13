"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useScheduleSelection } from "@/components/schedule-selection-provider";
import { ScheduleCheckbox } from "@/components/schedule-checkbox";
import type { ScheduleState } from "./schedule-timeline-item";

/**
 * The payment schedule as a ledger table, for a tablet or a laptop: every
 * installment on its own row with what is due, paid and left. Clicking a row
 * opens its actions (the same status buttons, payment form and payment
 * history the phone's rail shows) right under it. `ScheduleTimeline` builds
 * the rows, so both views run on the same optimistic state.
 */

export type LedgerRow = {
  id: string;
  /** 1-based position in the whole schedule. */
  number: number;
  dueDate: string;
  paidDate: string | null;
  note: string | null;
  state: ScheduleState;
  isNext: boolean;
  due: number;
  paid: number;
  remaining: number;
  /** "due in 14 days", "paid Sep 20 · 10 days early", … */
  subLabel: string;
  subTone: "slate" | "emerald" | "amber" | "rose";
  rollingInterestLabel?: string;
  actions: ReactNode;
  history?: ReactNode;
};

const PILL: Record<ScheduleState | "next", string> = {
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  partial:
    "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  overdue: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  pending: "bg-muted text-muted-foreground",
  next: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

const SUB_TONES = {
  slate: "text-muted-foreground",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  rose: "text-rose-600 dark:text-rose-300",
} as const;

type Filter = "all" | "unpaid" | "paid";

const money = (n: number) => `₱${n.toLocaleString()}`;

export function ScheduleLedger({
  rows,
  openId,
  mask,
}: {
  rows: LedgerRow[];
  /** The row that starts open: the first that needs attention. */
  openId?: string;
  mask(text: string): string;
}) {
  const { isEditing, isSelected, toggleId } = useScheduleSelection();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(openId ?? null);

  const paidCount = rows.filter((r) => r.state === "paid").length;
  const shown = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "paid"
        ? r.state === "paid"
        : r.state !== "paid",
  );
  const totals = rows.reduce(
    (t, r) => ({
      due: t.due + r.due,
      paid: t.paid + r.paid,
      remaining: t.remaining + r.remaining,
    }),
    { due: 0, paid: 0, remaining: 0 },
  );
  const thisYear = String(new Date().getFullYear());
  const columns = isEditing ? 8 : 7;

  return (
    <div
      className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1
        ring-black/5 lowercase dark:ring-white/10 [&_button]:lowercase"
    >
      <div className="flex flex-wrap items-center gap-2 p-3">
        <p className="px-1 text-sm font-black text-card-foreground/80">
          payment schedule
        </p>
        <p className="text-xs font-semibold text-muted-foreground">
          {paidCount} of {rows.length} paid
        </p>
        <div className="ml-auto flex gap-1.5">
          {(["all", "unpaid", "paid"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                `rounded-full border px-2.5 py-1 text-xs font-semibold
                transition-colors`,
                filter === f
                  ? `border-emerald-500/40 bg-emerald-500/10 text-emerald-600
                    dark:text-emerald-400`
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead
          className="sticky top-[66px] z-10 border-y bg-card text-[11px]
            text-muted-foreground"
        >
          <tr>
            {isEditing && <th className="w-8 py-2 pl-3" />}
            <th className="w-10 px-3 py-2 text-left font-semibold">#</th>
            <th className="px-3 py-2 text-left font-semibold">due</th>
            <th className="px-3 py-2 text-right font-semibold">amount</th>
            <th className="px-3 py-2 text-right font-semibold">paid</th>
            <th className="px-3 py-2 text-right font-semibold">left</th>
            <th className="px-3 py-2 text-left font-semibold">status</th>
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td
                colSpan={columns}
                className="px-3 py-10 text-center text-sm font-semibold
                  text-muted-foreground"
              >
                nothing {filter === "paid" ? "paid yet" : "left to pay"}
              </td>
            </tr>
          )}
          {shown.map((r, k) => {
            const year = r.dueDate.slice(0, 4);
            const before = k > 0 ? shown[k - 1].dueDate.slice(0, 4) : thisYear;
            const expanded = open === r.id && !isEditing;
            const selected = isSelected(r.id);
            return (
              <Fragment key={r.id}>
                {year !== before && (
                  <tr aria-label={year}>
                    <td
                      colSpan={columns}
                      className="bg-muted/50 px-3 py-1 text-center text-[11px]
                        font-black text-muted-foreground tabular-nums"
                    >
                      {year}
                    </td>
                  </tr>
                )}
                <tr
                  id={r.isNext ? "next-schedule" : undefined}
                  onClick={() =>
                    isEditing ? toggleId(r.id) : setOpen(expanded ? null : r.id)
                  }
                  aria-expanded={isEditing ? undefined : expanded}
                  className={cn(
                    "cursor-pointer border-b transition-colors",
                    selected
                      ? "bg-sky-500/10"
                      : r.isNext
                        ? "bg-amber-50 dark:bg-amber-500/10"
                        : expanded
                          ? "bg-muted/40"
                          : "hover:bg-muted/50",
                  )}
                >
                  {isEditing && (
                    <td className="py-3 pl-3">
                      <ScheduleCheckbox scheduleId={r.id} />
                    </td>
                  )}
                  <td
                    className="px-3 py-3 text-xs font-bold text-muted-foreground
                      tabular-nums"
                  >
                    {r.number}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "font-bold whitespace-nowrap",
                        r.state === "paid" && "text-muted-foreground",
                      )}
                    >
                      {formatDate(r.dueDate)}
                    </span>
                    {r.note && (
                      <span
                        className="block max-w-56 truncate text-[11px]
                          font-semibold text-muted-foreground"
                      >
                        {r.note}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        r.state === "paid" && "text-muted-foreground",
                      )}
                    >
                      {mask(money(r.due))}
                    </span>
                    {r.rollingInterestLabel && (
                      <span
                        className="block text-[11px] font-semibold
                          whitespace-nowrap text-muted-foreground"
                      >
                        {r.rollingInterestLabel}
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right font-bold tabular-nums",
                      r.paid > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {r.paid > 0 ? mask(money(r.paid)) : "–"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right font-bold tabular-nums",
                      r.remaining <= 0 && "text-muted-foreground/60",
                    )}
                  >
                    {r.remaining > 0 ? mask(money(r.remaining)) : "–"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        `inline-block rounded-full px-2 py-0.5 text-[11px]
                        font-bold`,
                        PILL[
                          r.isNext && r.state === "pending" ? "next" : r.state
                        ],
                      )}
                    >
                      {r.isNext && r.state === "pending" ? "next" : r.state}
                    </span>
                    <span
                      className={cn(
                        "block text-[11px] font-semibold whitespace-nowrap",
                        SUB_TONES[r.subTone],
                      )}
                    >
                      {r.subLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {!isEditing && (
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "size-4 transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b bg-muted/30">
                    <td />
                    <td colSpan={columns - 1} className="px-3 py-3">
                      {/* The phone's own controls, so paying works the same. */}
                      <div className="max-w-xl space-y-3">
                        {r.actions}
                        {r.history}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-sm font-black text-card-foreground/80">
            {isEditing && <td />}
            <td />
            <td className="px-3 py-3">total</td>
            <td className="px-3 py-3 text-right tabular-nums">
              {mask(money(totals.due))}
            </td>
            <td
              className="px-3 py-3 text-right text-emerald-700 tabular-nums
                dark:text-emerald-400"
            >
              {mask(money(totals.paid))}
            </td>
            <td className="px-3 py-3 text-right tabular-nums">
              {mask(money(totals.remaining))}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
