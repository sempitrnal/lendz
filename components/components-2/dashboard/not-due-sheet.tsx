"use client";

import { paidDay } from "@/lib/paid-day";
import { Sheet } from "@/components/dashboard/checklist-v2/sheet";
import { formatPeso } from "@/lib/dashboard-data";
import { HIDDEN_AMOUNT } from "@/lib/hide-amounts";
import { NameChip } from "@/components/name-chip";
import type { NotDuePayment } from "@/lib/dashboard/daily-profit";

/**
 * The profit calendar's "not due this month" profit, payment by payment and
 * grouped by the month each installment was due. Opens from the breakdown.
 */

export type NotDueGroup = {
  /** "2026-10": the month these installments were due. */
  due: string;
  profit: number;
  payments: NotDuePayment[];
};

const short = (date: string) => {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
};

const longMonth = (month: string) => {
  const [y, mo] = month.split("-").map(Number);
  return new Date(y, mo - 1, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toLowerCase();
};

type CategoryGroup = {
  name: string;
  color: string | null;
  profit: number;
  payments: NotDuePayment[];
};

/**
 * A month's payments split by the payer's first category (so nothing is
 * counted twice), A to Z with "uncategorized" last; each list newest first.
 */
function byCategory(payments: NotDuePayment[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const p of payments) {
    const category = p.categories[0];
    const name = category?.name ?? "uncategorized";
    let group = groups.get(name);
    if (!group) {
      group = {
        name,
        color: category?.color ?? null,
        profit: 0,
        payments: [],
      };
      groups.set(name, group);
    }
    group.profit += p.profit;
    group.payments.push(p);
  }
  for (const group of groups.values()) {
    group.profit = Math.round(group.profit * 100) / 100;
    group.payments.sort(
      (a, b) =>
        b.paidDate.localeCompare(a.paidDate) || a.id.localeCompare(b.id),
    );
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.name === "uncategorized") - Number(b.name === "uncategorized") ||
      a.name.localeCompare(b.name),
  );
}

export function NotDueSheet({
  open,
  onClose,
  month,
  monthName,
  groups,
  total,
  hide,
}: {
  open: boolean;
  onClose(): void;
  /** The month on the calendar, "2026-11". */
  month: string;
  /** Its short name, "nov". */
  monthName: string;
  groups: NotDueGroup[];
  total: number;
  hide: boolean;
}) {
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);

  return (
    <Sheet open={open} onClose={onClose} label="Profit not due this month">
      <div className="px-5 pt-2 pb-6 lowercase">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-card-foreground/80">
              not due in {monthName}
            </h2>
            <p className="text-xs font-semibold text-muted-foreground">
              every payment that added profit, by the month it was due
            </p>
          </div>
          <p
            className="shrink-0 text-lg font-bold text-sky-700 tabular-nums
              dark:text-sky-300"
          >
            {mask(formatPeso(total))}
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <section key={group.due} aria-label={longMonth(group.due)}>
              <div
                className="flex items-center justify-between gap-2 rounded-lg
                  bg-sky-50 px-3 py-1.5 dark:bg-sky-500/10"
              >
                <p className="text-xs font-bold text-sky-800 dark:text-sky-300">
                  {longMonth(group.due)}
                  <span className="ml-1.5 font-semibold text-muted-foreground">
                    {group.due < month ? "paid late" : "paid ahead"}
                  </span>
                </p>
                <p
                  className="text-xs font-bold text-sky-800 tabular-nums
                    dark:text-sky-300"
                >
                  {mask(formatPeso(group.profit))}
                </p>
              </div>
              {byCategory(group.payments).map((category) => (
                <div
                  key={category.name}
                  className="mt-2 rounded-xl bg-muted/40 px-2 pt-1.5 pb-0.5"
                >
                  <div className="flex items-center justify-between gap-2 px-1">
                    <p
                      className="flex items-center gap-1.5 text-[11px] font-bold
                        text-muted-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ backgroundColor: category.color ?? "#94a3b8" }}
                      />
                      {category.name}
                    </p>
                    <p
                      className="text-[11px] font-bold text-muted-foreground
                        tabular-nums"
                    >
                      {mask(formatPeso(category.profit))}
                    </p>
                  </div>
                  <ul className="divide-y divide-border">
                    {category.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-3 px-1
                          py-2.5"
                      >
                        <div className="min-w-0">
                          <NameChip name={p.name} color={category.color} />
                          <p
                            className="text-xs font-semibold
                              text-muted-foreground"
                          >
                            paid {paidDay(p.paidDate, short)} · due{" "}
                            {short(p.dueDate)} · {mask(formatPeso(p.amount))}
                          </p>
                        </div>
                        <p
                          className="shrink-0 text-sm font-bold text-emerald-600
                            tabular-nums dark:text-emerald-300"
                        >
                          {mask(`+${formatPeso(p.profit)}`)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
