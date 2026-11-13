"use client";

import Link from "next/link";
import { ArrowDownLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPeso, type OverdueBorrower } from "@/lib/dashboard-data";
import { lateLabel } from "@/lib/checklist/late-label";
import type { RecentPayment } from "@/components/components-2/dashboard/wallet-home";

/**
 * Cards the phone and laptop dashboards share: recent payments, and the
 * ranked list of who owes the most.
 */

export const card =
  "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10";

/** The first letters of a name, for the round avatar. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (
      (parts[0]?.[0] ?? "") +
      (parts.length > 1 ? parts[parts.length - 1][0] : "")
    ).toLowerCase() || "?"
  );
}

/**
 * Recent payments: a one-line summary of what these payments brought in, then
 * one tidy row each: who, what kind and when, and the money on the right.
 */
export function PaymentsCard({
  payments,
  mask,
}: {
  payments: RecentPayment[];
  mask(text: string): string;
}) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const profit = payments.reduce((sum, p) => sum + (p.profit ?? 0), 0);
  return (
    <div className={cn(card, "lowercase")}>
      <div className="flex items-center gap-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center
            rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20
            dark:text-emerald-300"
        >
          <ArrowDownLeft className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-black text-card-foreground/80">
          recent payments
        </h2>
        <Link
          href="/daily-checklist"
          className="ml-auto flex items-center text-xs font-semibold
            text-emerald-600 dark:text-emerald-400"
        >
          see all <ChevronRight className="size-3" />
        </Link>
      </div>

      {payments.length === 0 ? (
        <p
          className="py-4 text-center text-xs font-semibold
            text-muted-foreground"
        >
          No payments yet
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="text-[11px] font-semibold text-muted-foreground">
                last {payments.length} payments
              </p>
              <p
                className="text-base font-black text-card-foreground/80
                  tabular-nums"
              >
                {mask(formatPeso(total))}
              </p>
            </div>
            <div
              className="rounded-xl bg-emerald-50 px-3 py-2
                dark:bg-emerald-500/10"
            >
              <p
                className="text-[11px] font-semibold text-emerald-700
                  dark:text-emerald-400"
              >
                profit in them
              </p>
              <p
                className="text-base font-black text-emerald-700 tabular-nums
                  dark:text-emerald-300"
              >
                +{mask(formatPeso(profit))}
              </p>
            </div>
          </div>
          <ul className="mt-1 divide-y">
            {payments.map((p) => {
              const cash = p.loanType === "cash_advance";
              const row = (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      `flex size-10 shrink-0 items-center justify-center
                        rounded-full text-xs font-black`,
                      cash
                        ? `bg-amber-100 text-amber-800 dark:bg-amber-500/20
                          dark:text-amber-200`
                        : `bg-violet-100 text-violet-800 dark:bg-violet-500/20
                          dark:text-violet-200`,
                    )}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-bold
                        text-card-foreground/80"
                    >
                      {p.name}
                    </span>
                    <span
                      className="block truncate text-[11px] font-semibold
                        text-muted-foreground"
                    >
                      {cash ? "cash advance" : (p.loanType ?? "loan")}
                      {p.dueDate && ` · due ${p.dueDate.toLowerCase()}`} ·{" "}
                      {p.date.toLowerCase()}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className="block text-sm font-black text-slate-700
                        tabular-nums dark:text-slate-200"
                    >
                      {mask(formatPeso(p.amount))}
                    </span>
                    {p.profit != null && p.profit > 0 && (
                      <span
                        className="block text-[11px] font-bold text-emerald-600
                          tabular-nums dark:text-emerald-400"
                      >
                        +{mask(formatPeso(p.profit))}
                      </span>
                    )}
                  </span>
                </>
              );
              const href = p.accountId
                ? `/accounts/${p.accountId}`
                : p.borrowerId
                  ? `/borrowers/${p.borrowerId}`
                  : null;
              const rowClass = "flex items-center gap-3 py-2.5";
              return (
                <li key={p.id}>
                  {href ? (
                    <Link
                      href={href}
                      className={cn(rowClass, "active:bg-muted/60")}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className={rowClass}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** The borrowers owing the most, each with a bar against the biggest. */
export function OwingList({
  topOverdue,
  mask,
}: {
  topOverdue: OverdueBorrower[];
  mask(text: string): string;
}) {
  const biggest = Math.max(1, ...topOverdue.map((b) => b.amount));
  return (
    <ul>
      {topOverdue.map((b, i) => (
        <li key={b.id}>
          <Link
            href={`/borrowers/${b.id}`}
            className="flex items-center gap-3 py-2 hover:bg-muted/60
              active:bg-muted/60"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center
                rounded-full bg-rose-100 text-[11px] font-black text-rose-700
                dark:bg-rose-500/20 dark:text-rose-300"
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className="truncate text-sm font-bold text-card-foreground/80"
                >
                  {b.name}
                </span>
                <span
                  className="shrink-0 text-sm font-black text-rose-600
                    tabular-nums dark:text-rose-400"
                >
                  {mask(formatPeso(b.amount))}
                </span>
              </span>
              <span className="mt-1 flex items-center gap-2">
                <span className="h-1.5 flex-1 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-rose-400"
                    style={{ width: `${(b.amount / biggest) * 100}%` }}
                  />
                </span>
                <span
                  className="shrink-0 text-[11px] font-bold
                    text-muted-foreground"
                >
                  {lateLabel(b.oldestDaysLate).short} late
                </span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
