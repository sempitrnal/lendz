"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";

import { NameChip } from "@/components/name-chip";
import { tint } from "@/lib/category-tint";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatAmount, shortDate } from "@/lib/account-card/summary";
import { HIDDEN_AMOUNT, useHideAmounts } from "@/lib/hide-amounts";
import {
  RENEWAL_MONTHS,
  type RenewalAccount,
  type RenewalBorrower,
  type RenewalGroup,
} from "@/lib/renewals";

/**
 * Potential renewals: borrowers with an account near its end, grouped by
 * category. Each account shows how much is left and, when some installments
 * are part paid, each of those with what is still owed under them.
 */

const peso = (n: number) => `₱${formatAmount(n)}`;

const monthsText = (n: number) => `${n} month${n === 1 ? "" : "s"} left`;

/** "1 month left" green-ish, "3 months left" calmer: how close it is. */
const monthsTone = (n: number) =>
  n <= 1
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
    : n === 2
      ? "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200"
      : "bg-muted text-muted-foreground";

function AccountBlock({
  account,
  mask,
}: {
  account: RenewalAccount;
  mask: (text: string) => string;
}) {
  const paid = account.total - account.left;
  const pct = account.total > 0 ? (paid / account.total) * 100 : 0;
  const cash = account.type === "cash_advance";
  return (
    <Link
      href={`/accounts/${account.id}`}
      className="group block rounded-xl border border-border/70 bg-card px-2.5
        py-2 transition hover:border-border hover:shadow-sm active:scale-[0.99]"
    >
      {/* Principal and type, then the balance left: the card's answer. */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[15px] font-black tracking-tight
            text-card-foreground/85 tabular-nums"
        >
          {mask(peso(account.principal))}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-black",
            cash
              ? `bg-amber-100 text-amber-800 dark:bg-amber-500/15
                dark:text-amber-300`
              : "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
          )}
        >
          {cash ? "cash advance" : "loan"}
        </span>
        <span className="ml-auto text-right leading-none">
          <span className="block text-[10px] font-bold text-muted-foreground">
            left
          </span>
          <span
            className="text-sm font-black text-card-foreground/85 tabular-nums"
          >
            {mask(peso(account.balance))}
          </span>
        </span>
      </div>

      {/* How far along, with when it's next due and last paid. */}
      <div className="mt-1.5 flex items-center gap-2">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${paid} of ${account.total} installments paid`}
        >
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className="shrink-0 text-[11px] font-bold text-muted-foreground
            tabular-nums"
        >
          <span className="text-card-foreground/80">{account.left}</span> of{" "}
          {account.total} left
        </span>
      </div>
      <p
        className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px]
          font-semibold text-muted-foreground tabular-nums"
      >
        {account.nextDue && <span>next {shortDate(account.nextDue)}</span>}
        {account.lastPaid && (
          <span>· last paid {shortDate(account.lastPaid)}</span>
        )}
        {account.overdue > 0 && (
          <span className="font-bold text-rose-600 dark:text-rose-400">
            · {account.overdue} overdue
          </span>
        )}
      </p>

      {account.partials.length > 0 && (
        <ul
          className="mt-1.5 divide-y divide-[#9784d8]/15 rounded-lg
            bg-[#9784d8]/10 px-2"
        >
          {account.partials.map((p) => (
            <li
              key={p.scheduleId}
              className="flex items-center justify-between gap-2 py-1
                text-[11px] font-semibold text-muted-foreground tabular-nums"
            >
              <span className="min-w-0 truncate">
                <span className="font-black text-[#7a66c0] dark:text-[#a99ad6]">
                  partial
                </span>{" "}
                {shortDate(p.dueDate)}
                {p.lastPaid && ` · paid ${shortDate(p.lastPaid)}`}
              </span>
              <span className="shrink-0 font-black text-card-foreground/75">
                {mask(peso(p.paid))}
                <span className="font-semibold text-muted-foreground">
                  /{mask(peso(p.due))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

function BorrowerCard({
  borrower,
  color,
  mask,
}: {
  borrower: RenewalBorrower;
  color: string | null;
  mask: (text: string) => string;
}) {
  return (
    <li className="px-1 py-2.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link
          href={`/borrowers/${borrower.id}`}
          className="min-w-0 hover:opacity-80"
        >
          <NameChip name={borrower.name} color={color} />
        </Link>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
            monthsTone(borrower.monthsLeft),
          )}
        >
          {monthsText(borrower.monthsLeft)}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        {borrower.accounts.map((account) => (
          <AccountBlock key={account.id} account={account} mask={mask} />
        ))}
      </div>
    </li>
  );
}

const FILTERS = [0, 1, 2, 3].filter((n) => n <= RENEWAL_MONTHS);

export function RenewalsView({ groups }: { groups: RenewalGroup[] }) {
  const [hide, toggleHide] = useHideAmounts();
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  /** 0: all; otherwise only borrowers with at most this many months left. */
  const [within, setWithin] = useState(0);
  const [hideOverdue, setHideOverdue] = useState(false);

  /** One category's borrowers only; null for every category. */
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      groups
        .map((group) => {
          const borrowers = group.borrowers.filter(
            (b) =>
              (within === 0 || b.monthsLeft <= within) &&
              (!hideOverdue || b.overdue === 0),
          );
          return {
            ...group,
            borrowers,
            balance: borrowers.reduce((sum, b) => sum + b.balance, 0),
          };
        })
        .filter((group) => group.borrowers.length > 0),
    [groups, within, hideOverdue],
  );
  // A picked category that the other filters emptied falls back to all.
  const picked = filtered.some((g) => g.name === category) ? category : null;
  const shown = picked ? filtered.filter((g) => g.name === picked) : filtered;

  const borrowers = shown.flatMap((g) => g.borrowers);
  const accounts = borrowers.reduce((sum, b) => sum + b.accounts.length, 0);
  const balance = shown.reduce((sum, g) => sum + g.balance, 0);
  const withOverdue = groups
    .flatMap((g) => g.borrowers)
    .filter((b) => b.overdue > 0).length;

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
          <p className="text-xs font-bold tracking-wider">renewals</p>
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
          <p className="text-xs font-semibold opacity-80">
            bimonthly accounts with {RENEWAL_MONTHS} months or less left
          </p>
          <p
            className="truncate text-[40px] leading-tight font-black
              tracking-tight tabular-nums"
          >
            {borrowers.length} borrower{borrowers.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold
                tabular-nums"
            >
              {accounts} account{accounts === 1 ? "" : "s"}
            </span>
            <span
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold
                tabular-nums"
            >
              {mask(peso(balance))} left to collect
            </span>
          </div>
        </div>
      </div>

      <div data-settle className="relative z-10 -mt-8 space-y-3 px-3 sm:px-6">
        {/* Filters: how close to the end, and whether to leave out borrowers
            who are behind. */}
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-card p-2
            shadow-sm ring-1 ring-black/5 dark:ring-white/10"
        >
          {FILTERS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={within === n}
              onClick={() => setWithin(n)}
              className={cn(
                `rounded-full px-3 py-1.5 text-xs font-bold transition
                active:scale-95`,
                within === n
                  ? `bg-linear-to-br from-emerald-400 to-emerald-500 text-white
                    shadow-sm shadow-emerald-500/25`
                  : "border border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {n === 0 ? "all" : `${n} month${n === 1 ? "" : "s"}`}
            </button>
          ))}
          {withOverdue > 0 && (
            <button
              type="button"
              aria-pressed={hideOverdue}
              onClick={() => setHideOverdue((v) => !v)}
              className={cn(
                `ml-auto rounded-full px-3 py-1.5 text-xs font-bold transition
                active:scale-95`,
                hideOverdue
                  ? `bg-linear-to-br from-rose-400 to-rose-500 text-white
                    shadow-sm shadow-rose-500/25`
                  : `border border-rose-300/70 text-rose-700/80
                    hover:bg-rose-500/10 dark:border-rose-400/30
                    dark:text-rose-300/80`,
              )}
            >
              {hideOverdue ? "overdue hidden" : `hide overdue · ${withOverdue}`}
            </button>
          )}
        </div>

        {/* One button per category, to look at a single group. */}
        {filtered.length > 1 && (
          <div
            className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5
              [scrollbar-width:none] sm:-mx-6 sm:px-6"
          >
            <button
              type="button"
              aria-pressed={picked === null}
              onClick={() => setCategory(null)}
              className={cn(
                `shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold
                transition active:scale-95`,
                picked === null
                  ? "border-transparent bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              all categories
            </button>
            {filtered.map((group) => {
              const on = picked === group.name;
              return (
                <button
                  key={group.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(on ? null : group.name)}
                  className={cn(
                    `flex shrink-0 items-center gap-1.5 rounded-full border px-3
                    py-1.5 text-xs font-bold lowercase transition
                    active:scale-95`,
                    on
                      ? "text-card-foreground"
                      : `border-border bg-card text-muted-foreground
                        hover:bg-muted`,
                  )}
                  style={
                    on
                      ? {
                          backgroundColor: tint(group.color, 0.22),
                          borderColor: tint(group.color, 0.7),
                        }
                      : undefined
                  }
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color ?? "#94a3b8" }}
                  />
                  {group.name}
                  <span className="opacity-60 tabular-nums">
                    {group.borrowers.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="no renewals yet"
            description={
              groups.length === 0
                ? `no active bimonthly account has ${RENEWAL_MONTHS} months or less left.`
                : "nobody matches these filters."
            }
          />
        ) : (
          // Laptop and up: the groups flow into two or three columns.
          <div className="space-y-3 lg:columns-2 lg:gap-3 2xl:columns-3">
            {shown.map((group) => (
              <section
                key={group.name}
                aria-label={group.name}
                className="rounded-2xl bg-card p-2 shadow-sm ring-1 ring-black/5
                  lg:break-inside-avoid dark:ring-white/10"
              >
                <div
                  className="flex items-center justify-between gap-2 px-2 pt-1.5
                    pb-0.5"
                >
                  <p
                    className="flex min-w-0 items-center gap-2 text-base
                      font-black text-card-foreground/80"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color ?? "#94a3b8" }}
                    />
                    <span className="truncate">{group.name}</span>
                    <span
                      className="text-xs font-bold text-muted-foreground
                        tabular-nums"
                    >
                      {group.borrowers.length}
                    </span>
                  </p>
                  <p
                    className="shrink-0 text-xs font-bold text-muted-foreground
                      tabular-nums"
                  >
                    {mask(peso(group.balance))}
                  </p>
                </div>
                <ul className="divide-y divide-border/70">
                  {group.borrowers.map((borrower) => (
                    <BorrowerCard
                      key={borrower.id}
                      borrower={borrower}
                      color={group.color}
                      mask={mask}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
