"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  Bell,
  CalendarClock,
  ChevronRight,
  Eye,
  EyeOff,
  HandCoins,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPeso,
  formatPesoCompact,
  type CurrentMonthData,
  type DashboardSummary,
  type MonthlyProfit,
  type OverdueBorrower,
  type OverdueBucket,
} from "@/lib/dashboard-data";
import { HIDDEN_AMOUNT, useHideAmounts } from "@/lib/hide-amounts";
import MonthPicker from "@/components/month-picker";
import HeaderSearch from "@/components/header-search";
import ThemeToggle from "@/components/theme-toggle";

export type RecentPayment = {
  id: string;
  borrowerId: string | null;
  accountId: string | null;
  name: string;
  amount: number;
  date: string;
  loanType: string | null;
  frequency: string | null;
  rate: number | null;
  dueDate: string | null;
  /** Profit this payment added; null when the account is unknown. */
  profit: number | null;
};

const CHIP_TONES = {
  slate: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
} as const;

function Chip({
  tone,
  children,
}: {
  tone: keyof typeof CHIP_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        CHIP_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Dot colour per loan type; anything new falls back to grey. */
const TYPE_DOTS: Record<string, string> = {
  loan: "bg-purple-500",
  cash_advance: "bg-yellow-400",
};

const BUCKET_COLORS = [
  "bg-amber-300",
  "bg-orange-300",
  "bg-rose-300",
  "bg-rose-400",
  "bg-red-500",
];

const card =
  "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10";

export function WalletHome({
  summary,
  currentMonth,
  activeMonth,
  profitPerMonth,
  overdueBuckets,
  topOverdue,
  payments,
}: {
  summary: DashboardSummary;
  currentMonth: CurrentMonthData;
  activeMonth: string;
  profitPerMonth: MonthlyProfit[];
  overdueBuckets: OverdueBucket[];
  topOverdue: OverdueBorrower[];
  payments: RecentPayment[];
}) {
  const [hide, toggleHide] = useHideAmounts();
  const [tab, setTab] = useState<"outstanding" | "profit">("outstanding");

  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);

  const collectedPct = currentMonth.toCollectThisMonth
    ? Math.min(
        100,
        Math.round(
          (currentMonth.collected / currentMonth.toCollectThisMonth) * 100,
        ),
      )
    : 0;
  const principalPct =
    summary.outstanding > 0
      ? (summary.outstandingPrincipal / summary.outstanding) * 100
      : 0;
  const chartMonths = profitPerMonth.slice(-6);
  const maxProfit = Math.max(
    1,
    ...chartMonths.map((m) => Math.max(m.actual, m.expected)),
  );
  const thisMonth = chartMonths[chartMonths.length - 1];
  const lastMonth = chartMonths[chartMonths.length - 2];
  const profitDelta =
    thisMonth && lastMonth && lastMonth.actual > 0
      ? Math.round(
          ((thisMonth.actual - lastMonth.actual) / lastMonth.actual) * 100,
        )
      : null;
  const profitTotal = chartMonths.reduce((sum, m) => sum + m.actual, 0);
  const profitAvg = chartMonths.length ? profitTotal / chartMonths.length : 0;
  const bestMonth = chartMonths.reduce<MonthlyProfit | null>(
    (best, m) => (!best || m.actual > best.actual ? m : best),
    null,
  );
  const agingTotal = overdueBuckets.reduce((s, b) => s + b.amount, 0);

  const shortcuts = [
    {
      label: "Overdue",
      href: "/upcoming",
      icon: AlertTriangle,
      tone: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
      badge: summary.overdueBorrowers,
    },
    {
      label: "Due today",
      href: "/daily-checklist",
      icon: CalendarClock,
      tone: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
      badge: summary.duesTodaySchedules,
    },
    {
      label: "Borrowers",
      href: "/borrowers",
      icon: Users,
      tone: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
      badge: 0,
    },
    {
      label: "New loan",
      href: "/accounts",
      icon: HandCoins,
      tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
      badge: 0,
    },
  ];

  const banners = [
    {
      title:
        summary.duesTodaySchedules > 0
          ? `${summary.duesTodaySchedules} due today`
          : "Nothing due today",
      sub: formatPeso(summary.duesToday),
      href: "/daily-checklist",
      icon: CalendarClock,
      tone: "from-amber-200 to-orange-100 text-amber-900 dark:from-amber-500/25 dark:to-orange-500/10 dark:text-amber-200",
    },
    {
      title:
        summary.overdueBorrowers > 0
          ? `${summary.overdueBorrowers} overdue`
          : "No overdue",
      sub: formatPeso(summary.overdue),
      href: "/upcoming",
      icon: AlertTriangle,
      tone: "from-rose-200 to-pink-100 text-rose-900 dark:from-rose-500/25 dark:to-pink-500/10 dark:text-rose-200",
    },
    {
      title: `${collectedPct}% of this month`,
      sub: `${formatPeso(Math.max(0, currentMonth.toCollectThisMonth - currentMonth.collected))} to go`,
      href: "/due-this-month",
      icon: Sparkles,
      tone: "from-emerald-200 to-teal-100 text-emerald-900 dark:from-emerald-500/25 dark:to-teal-500/10 dark:text-emerald-200",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      {/* No z-index here: the green wash paints under the cards. On a phone the
          search lives in the persistent top bar above; the row here is for
          wider screens. */}
      <div
        data-settle-group="band"
        className="relative -mx-4 px-4 pt-20 pb-20 text-white sm:mx-0 sm:pt-4"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl sm:rounded-3xl"
        />
        <div className="relative z-20 hidden items-center gap-3 sm:flex">
          <HeaderSearch onColor className="flex-1 sm:max-w-none" />
          <ThemeToggle size="icon-sm" onColor />
          <Link
            href="/upcoming"
            aria-label="Overdue"
            className="relative shrink-0"
          >
            <Bell className="size-5" aria-hidden="true" />
            {summary.overdueBorrowers > 0 && (
              <span
                className="absolute -top-1 -right-1 size-2.5 rounded-full
                  bg-rose-400 ring-2 ring-(--page-1)"
              />
            )}
          </Link>
        </div>
        <p className="relative text-sm font-bold sm:mt-4">utangz dashboard</p>
        <p className="relative text-xs font-semibold opacity-80">
          {currentMonth.label}
        </p>
      </div>

      <div data-settle-group className="relative z-10 -mt-14 space-y-4 px-1">
        <div className={card}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-card-foreground/80">
              Monthly collections
            </p>
            <MonthPicker currentMonth={activeMonth} />
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div
              className="relative size-20 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(#34d399 ${collectedPct * 3.6}deg, #d1fae5 0)`,
              }}
            >
              <div
                className="absolute inset-2 flex items-center justify-center
                  rounded-full bg-card text-lg font-bold text-emerald-500"
              >
                {collectedPct}%
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                Collected
              </p>
              <p
                className="text-lg font-bold text-card-foreground/80
                  tabular-nums"
              >
                {mask(formatPeso(currentMonth.collected))}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                of {mask(formatPeso(currentMonth.toCollectThisMonth))}
              </p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-500/10">
              <dt
                className="text-xs font-semibold text-amber-700
                  dark:text-amber-400"
              >
                Profit collected
              </dt>
              <dd className="font-bold text-card-foreground/80 tabular-nums">
                {mask(
                  formatPeso(
                    Math.max(
                      0,
                      currentMonth.expectedProfit -
                        currentMonth.remainingProfit,
                    ),
                  ),
                )}
              </dd>
            </div>
            <div className="rounded-xl bg-muted p-2.5">
              <dt className="text-xs font-semibold text-muted-foreground">
                Profit remaining
              </dt>
              <dd className="font-bold text-card-foreground/80 tabular-nums">
                {mask(formatPeso(currentMonth.remainingProfit))}
              </dd>
            </div>
          </dl>
        </div>

        <div className={card}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-card-foreground/80">
                Profit per month
              </p>
              <p
                className="mt-1 text-2xl font-bold tracking-tight
                  text-card-foreground/80 tabular-nums"
              >
                {mask(formatPeso(thisMonth?.actual ?? 0))}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {thisMonth?.month} · of{" "}
                {mask(formatPeso(thisMonth?.expected ?? 0))} expected
              </p>
            </div>
            {profitDelta != null && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                  profitDelta >= 0
                    ? `bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20
                      dark:text-emerald-300`
                    : `bg-rose-100 text-rose-700 dark:bg-rose-500/20
                      dark:text-rose-300`,
                )}
              >
                {profitDelta >= 0 ? "▲" : "▼"} {Math.abs(profitDelta)}% vs last
                month
              </span>
            )}
          </div>

          <div className="mt-5 flex h-32 items-end gap-2">
            {chartMonths.map((m) => (
              <div
                key={m.key}
                className="flex h-full flex-1 flex-col items-center justify-end
                  gap-1"
                title={`${m.month}: ${formatPeso(m.actual)} of ${formatPeso(m.expected)}`}
              >
                <span
                  className={cn(
                    "text-[10px] font-bold tabular-nums",
                    m.isCurrent
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-muted-foreground",
                  )}
                >
                  {hide ? "•••" : formatPesoCompact(m.actual)}
                </span>
                <div className="relative w-full flex-1">
                  {/* What the month was due to earn, behind what it did. */}
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-lg
                      bg-amber-100 dark:bg-amber-500/10"
                    style={{ height: `${(m.expected / maxProfit) * 100}%` }}
                  />
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 rounded-t-lg bg-linear-to-t",
                      m.isCurrent
                        ? "from-orange-500 to-amber-300"
                        : "from-amber-400 to-amber-200",
                    )}
                    style={{
                      height: `${Math.max(2, (m.actual / maxProfit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-1.5 flex gap-2 text-[10px] font-semibold
              text-muted-foreground"
          >
            {chartMonths.map((m) => (
              <span key={m.key} className="flex-1 text-center">
                {m.short}
              </span>
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">
                6-mo total
              </dt>
              <dd
                className="text-sm font-bold text-card-foreground/80
                  tabular-nums"
              >
                {mask(formatPeso(profitTotal))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">
                Avg / month
              </dt>
              <dd
                className="text-sm font-bold text-card-foreground/80
                  tabular-nums"
              >
                {mask(formatPeso(profitAvg))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">
                Best month
              </dt>
              <dd className="text-sm font-bold text-card-foreground/80">
                {bestMonth?.short}{" "}
                <span className="tabular-nums">
                  {mask(formatPesoCompact(bestMonth?.actual ?? 0))}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className={cn(card, "overflow-hidden p-0")}>
          <div className="flex gap-1 bg-emerald-50 p-1.5 dark:bg-emerald-500/10">
            {(["outstanding", "profit"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  "flex-1 rounded-xl py-1.5 text-xs font-semibold capitalize",
                  tab === k
                    ? "bg-card text-emerald-600 shadow-sm"
                    : "text-emerald-700/60 dark:text-emerald-300/60",
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="p-4">
            <div
              className="flex items-center justify-between text-xs font-semibold
                text-muted-foreground"
            >
              <span>
                {tab === "outstanding"
                  ? `Outstanding balance · ${summary.activeLoans} active loans`
                  : "Profit still to earn"}
              </span>
              <button
                type="button"
                onClick={toggleHide}
                aria-label={hide ? "Show amounts" : "Hide amounts"}
              >
                {hide ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p
              className="mt-1 text-3xl font-bold tracking-tight
                text-card-foreground/80 tabular-nums"
            >
              {mask(
                formatPeso(
                  tab === "outstanding"
                    ? summary.outstanding
                    : summary.outstandingProfit,
                ),
              )}
            </p>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-emerald-400"
                style={{ width: `${principalPct}%` }}
              />
              <div className="flex-1 bg-amber-300" />
            </div>
            <div
              className="mt-2 flex justify-between text-xs font-semibold
                text-muted-foreground"
            >
              <span>
                ● Principal{" "}
                <b className="text-card-foreground/80">
                  {mask(formatPeso(summary.outstandingPrincipal))}
                </b>
              </span>
              <span>
                ● Profit{" "}
                <b className="text-card-foreground/80">
                  {mask(formatPeso(summary.outstandingProfit))}
                </b>
              </span>
            </div>
          </div>
        </div>

        <div className={cn(card, "grid grid-cols-4 gap-2")}>
          {shortcuts.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  `relative flex size-12 items-center justify-center
                  rounded-full`,
                  a.tone,
                )}
              >
                <a.icon className="size-5" aria-hidden="true" />
                {a.badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex size-5 items-center
                      justify-center rounded-full bg-rose-500 text-[10px]
                      font-bold text-white"
                  >
                    {a.badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {a.label}
              </span>
            </Link>
          ))}
        </div>

        <div>
          <p className="mb-2 px-1 text-sm font-bold text-card-foreground/80">
            For you today
          </p>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {banners.map((b) => (
              <Link
                key={b.title}
                href={b.href}
                className={cn(
                  `relative w-56 shrink-0 snap-start overflow-hidden rounded-2xl
                  bg-linear-to-br p-4`,
                  b.tone,
                )}
              >
                <b.icon
                  className="absolute -right-2 -bottom-2 size-20 opacity-15"
                  aria-hidden="true"
                />
                <p className="relative text-base font-bold">{b.title}</p>
                <p className="relative mt-0.5 text-xs font-semibold opacity-80">
                  {b.sub}
                </p>
                <span
                  className="relative mt-3 inline-block rounded-full bg-white/70
                    px-3 py-1 text-xs font-bold dark:bg-white/10"
                >
                  Open
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className={card}>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-bold text-card-foreground/80">
              Recent payments
            </p>
            <Link
              href="/daily-checklist"
              className="flex items-center text-xs font-semibold
                text-emerald-500"
            >
              See all <ChevronRight className="size-3" />
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
            <ul className="divide-y">
              {payments.map((p) => {
                const row = (
                  <>
                    <span
                      className="flex size-9 items-center justify-center
                        rounded-full bg-emerald-100 text-emerald-600
                        dark:bg-emerald-500/15"
                    >
                      <ArrowDownLeft className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-bold
                          text-card-foreground/80"
                      >
                        {p.name}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Paid {p.date}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {p.loanType && (
                          <span
                            className="flex items-center gap-1 text-xs
                              font-semibold text-muted-foreground lowercase"
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "size-2 rounded-full",
                                TYPE_DOTS[p.loanType] ?? "bg-slate-400",
                              )}
                            />
                            {p.loanType.replace(/_/g, " ")}
                          </span>
                        )}
                        {p.dueDate && <Chip tone="amber">Due {p.dueDate}</Chip>}
                      </div>
                    </div>
                    <div
                      className="flex shrink-0 flex-col items-end justify-center
                        gap-1.5"
                    >
                      <span
                        className="text-sm font-bold text-slate-700 tabular-nums
                          dark:text-slate-200"
                      >
                        {mask(formatPeso(p.amount))}
                      </span>
                      {p.profit != null && (
                        <span
                          className="text-xs font-bold text-emerald-600
                            tabular-nums dark:text-emerald-400"
                        >
                          +{mask(formatPeso(p.profit))}
                        </span>
                      )}
                    </div>
                  </>
                );
                return (
                  <li key={p.id}>
                    {p.accountId || p.borrowerId ? (
                      <Link
                        href={
                          p.accountId
                            ? `/accounts/${p.accountId}`
                            : `/borrowers/${p.borrowerId}`
                        }
                        className="flex items-center gap-3 py-2.5"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-2.5">
                        {row}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={card}>
          <p className="mb-3 text-sm font-bold text-card-foreground/80">
            Overdue aging
          </p>
          <div className="space-y-2.5">
            {overdueBuckets.map((b, i) => {
              const pct = agingTotal > 0 ? (b.amount / agingTotal) * 100 : 0;
              return (
                <div key={b.label} className="flex items-center gap-3 text-xs">
                  <span
                    className="w-16 shrink-0 font-semibold
                      text-muted-foreground"
                  >
                    {b.label}
                  </span>
                  <div className="h-2.5 flex-1 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        BUCKET_COLORS[i % BUCKET_COLORS.length],
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className="w-20 text-right font-bold text-card-foreground/80
                      tabular-nums"
                  >
                    {mask(formatPeso(b.amount))}
                  </span>
                </div>
              );
            })}
          </div>
          {topOverdue.length > 0 && (
            <ul className="mt-3 divide-y border-t">
              {topOverdue.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/borrowers/${b.id}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span
                        className="block truncate font-semibold
                          text-card-foreground/80"
                      >
                        {b.name}
                      </span>
                      <span
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        {b.oldestDaysLate}d late
                      </span>
                    </span>
                    <span className="font-bold text-rose-500 tabular-nums">
                      {mask(formatPeso(b.amount))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
