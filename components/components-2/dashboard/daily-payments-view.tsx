"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Eye, EyeOff, HandCoins } from "lucide-react";

import DayPicker from "@/components/day-picker";
import { NameChip } from "@/components/name-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/dashboard-data";
import type { DayPayment } from "@/lib/dashboard/day-payments";
import { HIDDEN_AMOUNT, useHideAmounts } from "@/lib/hide-amounts";

/**
 * One day's payments: what came in, the profit in it, and each payment
 * grouped by the payer's category.
 */

const short = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
};

type CategoryGroup = {
  name: string;
  color: string | null;
  collected: number;
  profit: number;
  payments: DayPayment[];
};

/** Split by the payer's first category, A to Z with uncategorized last. */
function byCategory(payments: DayPayment[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const p of payments) {
    const category = p.categories[0];
    const name = category?.name ?? "uncategorized";
    let group = groups.get(name);
    if (!group) {
      group = {
        name,
        color: category?.color ?? null,
        collected: 0,
        profit: 0,
        payments: [],
      };
      groups.set(name, group);
    }
    group.collected += p.amount;
    group.profit += p.profit;
    group.payments.push(p);
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.name === "uncategorized") - Number(b.name === "uncategorized") ||
      a.name.localeCompare(b.name),
  );
}

type BorrowerGroup = {
  key: string;
  name: string | null;
  amount: number;
  profit: number;
  payments: DayPayment[];
};

/** A category's payments split by who paid, in the order they first appear. */
function byBorrower(payments: DayPayment[]): BorrowerGroup[] {
  const groups = new Map<string, BorrowerGroup>();
  for (const p of payments) {
    const key = p.borrowerId ?? `payment-${p.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, name: p.name, amount: 0, profit: 0, payments: [] };
      groups.set(key, group);
    }
    group.amount += p.amount;
    group.profit += p.profit;
    group.payments.push(p);
  }
  return [...groups.values()];
}

const ROW = "flex items-center justify-between gap-3 px-2 py-2.5";

function Amounts({
  amount,
  profit,
  mask,
}: {
  amount: number;
  profit: number;
  mask: (text: string) => string;
}) {
  return (
    <span className="shrink-0 text-right">
      <span
        className="block text-sm font-bold text-card-foreground/80 tabular-nums"
      >
        {mask(formatPeso(amount))}
      </span>
      <span
        className="block text-xs font-bold text-emerald-600 tabular-nums
          dark:text-emerald-300"
      >
        {mask(`+${formatPeso(profit)}`)}
      </span>
    </span>
  );
}

/** One payment: a link to its account when it has one. */
function PaymentRow({
  payment,
  mask,
  showName,
}: {
  payment: DayPayment;
  mask: (text: string) => string;
  /** False inside a borrower's group, which already names them. */
  showName: boolean;
}) {
  const body = (
    <>
      <span className="min-w-0">
        {showName ? (
          <NameChip
            name={payment.name}
            color={payment.categories[0]?.color ?? null}
          />
        ) : null}
        <span
          className={cn(
            "block truncate text-xs font-semibold text-muted-foreground",
            !showName && "text-card-foreground/70",
          )}
        >
          {payment.dueDate ? `due ${short(payment.dueDate)}` : "no due date"}
        </span>
      </span>
      <Amounts amount={payment.amount} profit={payment.profit} mask={mask} />
    </>
  );
  return payment.accountId ? (
    <Link
      href={`/accounts/${payment.accountId}`}
      className={`${ROW} rounded-xl active:bg-black/5 dark:active:bg-white/5`}
    >
      {body}
    </Link>
  ) : (
    <div className={ROW}>{body}</div>
  );
}

/**
 * A borrower who paid more than once that day: one row with the totals, and
 * the individual payments underneath when it is opened.
 */
function BorrowerRow({
  group,
  mask,
}: {
  group: BorrowerGroup;
  mask: (text: string) => string;
}) {
  const [open, setOpen] = useState(false);
  if (group.payments.length === 1) {
    return <PaymentRow payment={group.payments[0]} mask={mask} showName />;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${ROW} w-full rounded-xl text-left lowercase
          active:bg-black/5 dark:active:bg-white/5`}
      >
        <span className="min-w-0">
          <NameChip
            name={group.name}
            color={group.payments[0].categories[0]?.color ?? null}
          />
          <span
            className="flex items-center gap-1 text-xs font-semibold
              text-muted-foreground"
          >
            {group.payments.length} payments
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3.5 transition-transform duration-300",
                open && "rotate-180",
              )}
            />
          </span>
        </span>
        <Amounts amount={group.amount} profit={group.profit} mask={mask} />
      </button>
      {open ? (
        <ul className="mb-1 ml-3 border-l border-border/70 pl-2">
          {group.payments.map((p) => (
            <li key={p.id}>
              <PaymentRow payment={p} mask={mask} showName={false} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function DailyPaymentsView({
  payments,
  date,
  today,
}: {
  payments: DayPayment[];
  /** The day shown, "2026-11-12". */
  date: string;
  today: string;
}) {
  const [hide, toggleHide] = useHideAmounts();
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);

  const collected = payments.reduce((sum, p) => sum + p.amount, 0);
  const profit = payments.reduce((sum, p) => sum + p.profit, 0);
  const groups = byCategory(payments);

  return (
    <div className="pb-16 lowercase">
      {/* The green band; the search above it is the mobile top bar. */}
      <div
        data-settle-group="band"
        className="relative -mt-16 px-4 pt-[4.75rem] pb-14 text-white sm:mt-0
          sm:px-6 sm:pt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <div className="relative z-20 flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider">daily payments</p>
          <button
            type="button"
            onClick={toggleHide}
            aria-label={hide ? "Show amounts" : "Hide amounts"}
            className="flex size-9 shrink-0 items-center justify-center
              rounded-full bg-white/15 transition-transform active:scale-90"
          >
            {hide ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="relative z-20 mt-4">
          <p className="text-xs font-semibold opacity-80">collected</p>
          <p
            className="truncate text-[40px] leading-tight font-black
              tracking-tight tabular-nums"
          >
            {mask(formatPeso(collected))}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold
                tabular-nums"
            >
              {mask(`+${formatPeso(profit)}`)} profit
            </span>
            <span
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold
                tabular-nums"
            >
              {payments.length} payment{payments.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <div data-settle className="relative z-10 -mt-8 space-y-3 px-3 sm:px-6">
        <DayPicker date={date} today={today} />

        {payments.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="no payments"
            description="nothing was paid on this day."
          />
        ) : (
          groups.map((group) => (
            <section
              key={group.name}
              aria-label={group.name}
              className="rounded-2xl bg-card p-2 shadow-sm ring-1 ring-black/5
                dark:ring-white/10"
            >
              <div className="flex items-center justify-between gap-2 px-2 pt-1">
                <p
                  className="flex min-w-0 items-center gap-1.5 text-xs font-bold
                    text-muted-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color ?? "#94a3b8" }}
                  />
                  <span className="truncate">{group.name}</span>
                </p>
                <p
                  className="shrink-0 text-xs font-bold text-muted-foreground
                    tabular-nums"
                >
                  {mask(formatPeso(group.collected))}
                </p>
              </div>
              <ul className="divide-y divide-border/70">
                {byBorrower(group.payments).map((borrower) => (
                  <li key={borrower.key}>
                    <BorrowerRow group={borrower} mask={mask} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
