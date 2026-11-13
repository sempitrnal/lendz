"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ChevronRight,
  Eye,
  EyeOff,
  HandCoins,
  Plus,
  Sparkles,
  TrendingUp,
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
  type ProfitCategoryItem,
} from "@/lib/dashboard-data";
import { HIDDEN_AMOUNT, useHideAmounts } from "@/lib/hide-amounts";
import MonthPicker from "@/components/month-picker";
import HeaderSearch from "@/components/header-search";
import ThemeToggle from "@/components/theme-toggle";
import { ReleaseCalendar } from "@/components/components-2/dashboard/release-calendar";
import { NewLoanFlow } from "@/components/components-2/dashboard/new-loan-flow";
import { ProfitCalendar } from "@/components/components-2/dashboard/profit-calendar";
import {
  OwingList,
  PaymentsCard,
} from "@/components/components-2/dashboard/dashboard-cards";
import { WalletDesktop } from "@/components/components-2/dashboard/wallet-desktop";
import { TABLET_PX, useMinWidth } from "@/lib/hooks/use-min-width";

/**
 * The collection ring: it fills from empty to its percent when it appears, and
 * from the old figure to the new one when the month changes. The number counts
 * along with it.
 */
function CollectionRing({ pct }: { pct: number }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? pct : 0);
  const from = useRef(shown);

  useEffect(() => {
    if (reduceMotion) {
      from.current = pct;
      setShown(pct);
      return;
    }
    const controls = animate(from.current, pct, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [pct, reduceMotion]);

  return (
    <div
      role="img"
      aria-label={`${pct}% collected`}
      className="relative size-20 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(#34d399 ${shown * 3.6}deg, #d1fae5 0)`,
      }}
    >
      <div
        className="absolute inset-2 flex items-center justify-center
          rounded-full bg-card text-lg font-bold text-emerald-500 tabular-nums"
      >
        {Math.round(shown)}%
      </div>
    </div>
  );
}

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

const BUCKET_COLORS = [
  "bg-amber-300",
  "bg-orange-300",
  "bg-rose-300",
  "bg-rose-400",
  "bg-red-500",
];

const card =
  "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10";

/**
 * Overdue aging: the total, one bar split by how late it is (so the
 * proportions read at a glance), the five age groups under it, and the
 * borrowers owing the most, each with a bar against the biggest.
 */
function OverdueCard({
  buckets,
  total,
  topOverdue,
  mask,
}: {
  buckets: OverdueBucket[];
  total: number;
  topOverdue: OverdueBorrower[];
  mask(text: string): string;
}) {
  const count = buckets.reduce((sum, b) => sum + b.count, 0);
  return (
    <div className={cn(card, "lowercase")}>
      <div className="flex items-center gap-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center
            rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20
            dark:text-rose-300"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-black text-card-foreground/80">
          overdue aging
        </h2>
        <Link
          href="/upcoming"
          className="ml-auto flex items-center text-xs font-semibold
            text-emerald-600 dark:text-emerald-400"
        >
          see all <ChevronRight className="size-3" />
        </Link>
      </div>

      <p
        className="mt-3 text-2xl font-black tracking-tight text-rose-600
          tabular-nums dark:text-rose-400"
      >
        {mask(formatPeso(total))}
      </p>
      <p className="text-xs font-semibold text-muted-foreground">
        {count} overdue installment{count === 1 ? "" : "s"}
      </p>

      {total > 0 && (
        <div
          className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label="Overdue amount by how late it is"
        >
          {buckets.map((b, i) => (
            <span
              key={b.label}
              className={cn(BUCKET_COLORS[i % BUCKET_COLORS.length])}
              style={{ width: `${(b.amount / total) * 100}%` }}
            />
          ))}
        </div>
      )}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {buckets.map((b, i) => (
          <li key={b.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                BUCKET_COLORS[i % BUCKET_COLORS.length],
              )}
            />
            <span className="min-w-0 flex-1">
              <span
                className="block truncate font-semibold text-muted-foreground"
              >
                {b.label}
              </span>
              <span className="block font-bold text-card-foreground/80
                tabular-nums">
                {mask(formatPeso(b.amount))}
              </span>
            </span>
            <span
              className="shrink-0 text-[11px] font-bold text-muted-foreground
                tabular-nums"
            >
              {total > 0 ? Math.round((b.amount / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>

      {topOverdue.length > 0 && (
        <>
          <p
            className="mt-4 border-t pt-3 text-[11px] font-black tracking-wide
              text-muted-foreground uppercase"
          >
            owing the most
          </p>
          <div className="mt-1">
            <OwingList topOverdue={topOverdue} mask={mask} />
          </div>
        </>
      )}
    </div>
  );
}

export function WalletHome({
  summary,
  currentMonth,
  activeMonth,
  profitPerMonth,
  overdueBuckets,
  topOverdue,
  payments,
  profitPerCategory,
}: {
  summary: DashboardSummary;
  currentMonth: CurrentMonthData;
  activeMonth: string;
  profitPerMonth: MonthlyProfit[];
  overdueBuckets: OverdueBucket[];
  topOverdue: OverdueBorrower[];
  payments: RecentPayment[];
  /** The month's profit per category: the tablet and laptop view lists it. */
  profitPerCategory: ProfitCategoryItem[];
}) {
  const [hide, toggleHide] = useHideAmounts();
  const roomy = useMinWidth(TABLET_PX);

  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);

  const collectedPct = currentMonth.toCollectThisMonth
    ? Math.min(
        100,
        Math.round(
          (currentMonth.collected / currentMonth.toCollectThisMonth) * 100,
        ),
      )
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

  // A tablet or a laptop gets a view of its own (see WalletDesktop).
  if (roomy) {
    return (
      <WalletDesktop
        summary={summary}
        currentMonth={currentMonth}
        activeMonth={activeMonth}
        profitPerMonth={profitPerMonth}
        overdueBuckets={overdueBuckets}
        topOverdue={topOverdue}
        payments={payments}
        profitPerCategory={profitPerCategory}
        hide={hide}
        onToggleHide={toggleHide}
      />
    );
  }

  return (
    <div className="pb-6">
      {/* No z-index here: the green wash paints under the cards. On a phone the
          search lives in the persistent top bar above; the row here is for
          wider screens. */}
      <div
        data-settle-group="band"
        className="relative -mx-4 text-white sm:-mt-12 md:-mt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <div className="relative mx-auto max-w-2xl px-4 pt-20 pb-20 sm:pt-4">
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
          <div
            className="relative flex items-start justify-between gap-3 sm:mt-4"
          >
            <div>
              <p className="text-sm font-bold">utangz dashboard</p>
              <p className="text-xs font-semibold opacity-80">
                {currentMonth.label}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleHide}
              aria-label={hide ? "Show amounts" : "Hide amounts"}
              className="flex size-9 items-center justify-center rounded-full
                bg-white/15 active:bg-white/25"
            >
              {hide ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-14 max-w-2xl space-y-4 px-1">
        {/* Wide screens: charts and calendars on the left, two across when
            there is room; actions and lists in a column on the right. */}
        <div className="@container lg:min-w-0 lg:flex-1">
          <div
            className="space-y-4 lg:@2xl:grid lg:@2xl:grid-cols-2
              lg:@2xl:items-start lg:@2xl:gap-4 lg:@2xl:space-y-0"
          >
            <div data-settle-group className="space-y-4">
              <div className={cn(card, "lowercase")}>
                <div className="-mt-1 -mr-2 flex items-center gap-2">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center
                      rounded-full bg-emerald-100 text-emerald-700
                      dark:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <HandCoins className="size-4" aria-hidden="true" />
                  </span>
                  <h2
                    className="text-sm font-black whitespace-nowrap
                      text-card-foreground/80"
                  >
                    monthly collections
                  </h2>
                  <div className="ml-auto">
                    <MonthPicker currentMonth={activeMonth} variant="card" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <CollectionRing pct={collectedPct} />
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
                  <div
                    className="rounded-xl bg-amber-50 p-2.5
                      dark:bg-amber-500/10"
                  >
                    <dt
                      className="text-xs font-semibold text-amber-700
                        dark:text-amber-400"
                    >
                      profit collected (due this month)
                    </dt>
                    <dd
                      className="font-bold text-card-foreground/80 tabular-nums"
                    >
                      {mask(formatPeso(currentMonth.profitDueThisMonth))}
                    </dd>
                  </div>
                  <div
                    className="rounded-xl bg-emerald-50 p-2.5
                      dark:bg-emerald-500/10"
                  >
                    <dt
                      className="text-xs font-semibold text-emerald-700
                        dark:text-emerald-400"
                    >
                      total profit collected (this month)
                    </dt>
                    <dd
                      className="font-bold text-card-foreground/80 tabular-nums"
                    >
                      {mask(formatPeso(currentMonth.profitCollected))}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-xl bg-muted p-2.5">
                    <dt className="text-xs font-semibold text-muted-foreground">
                      profit remaining
                    </dt>
                    <dd
                      className="font-bold text-card-foreground/80 tabular-nums"
                    >
                      {mask(formatPeso(currentMonth.remainingProfit))}
                    </dd>
                  </div>
                </dl>
              </div>

              <ProfitCalendar hide={hide} />
            </div>

            <div data-settle-group className="space-y-4">
              <div className={cn(card, "lowercase")}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center
                      rounded-full bg-amber-100 text-amber-700
                      dark:bg-amber-500/20 dark:text-amber-300"
                  >
                    <TrendingUp className="size-4" aria-hidden="true" />
                  </span>
                  <h2
                    className="text-sm font-black whitespace-nowrap
                      text-card-foreground/80"
                  >
                    profit per month
                  </h2>
                  {profitDelta != null && (
                    <span
                      className={cn(
                        `ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px]
                        font-bold`,
                        profitDelta >= 0
                          ? `bg-emerald-100 text-emerald-700
                            dark:bg-emerald-500/20 dark:text-emerald-300`
                          : `bg-rose-100 text-rose-700 dark:bg-rose-500/20
                            dark:text-rose-300`,
                      )}
                    >
                      {profitDelta >= 0 ? "▲" : "▼"} {Math.abs(profitDelta)}% vs
                      last month
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <div>
                    <p
                      className="text-2xl font-bold tracking-tight
                        text-card-foreground/80 tabular-nums"
                    >
                      {mask(formatPeso(thisMonth?.actual ?? 0))}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {thisMonth?.month} · of{" "}
                      {mask(formatPeso(thisMonth?.expected ?? 0))} expected
                    </p>
                    {thisMonth?.projected != null && (
                      <p
                        className="mt-0.5 text-xs font-semibold text-emerald-700
                          dark:text-emerald-400"
                      >
                        projected {mask(formatPeso(thisMonth.projected))} ·{" "}
                        {thisMonth.projectedPercent}% collected over the last{" "}
                        {thisMonth.projectionMonths === 1
                          ? "month"
                          : `${thisMonth.projectionMonths} months`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex h-32 items-end gap-2">
                  {chartMonths.map((m) => (
                    <div
                      key={m.key}
                      className="flex h-full flex-1 flex-col items-center
                        justify-end gap-1"
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
                          style={{
                            height: `${(m.expected / maxProfit) * 100}%`,
                          }}
                        />
                        <div
                          className={cn(
                            `absolute inset-x-0 bottom-0 rounded-t-lg
                            bg-linear-to-t`,
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
                    <dt
                      className="text-[11px] font-semibold
                        text-muted-foreground"
                    >
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
                    <dt
                      className="text-[11px] font-semibold
                        text-muted-foreground"
                    >
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
                    <dt
                      className="text-[11px] font-semibold
                        text-muted-foreground"
                    >
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

              <ReleaseCalendar hide={hide} />
            </div>
          </div>
        </div>

        <div
          data-settle-group
          className="space-y-4 lg:w-80 lg:shrink-0 xl:w-96"
        >
          <NewLoanFlow>
            {({ open, warm }) => (
              <div className="grid grid-cols-2 gap-2.5 lowercase">
                <button
                  type="button"
                  onPointerDown={warm}
                  onClick={open}
                  className="relative row-span-2 flex flex-col justify-between
                    overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500
                    to-teal-600 p-4 text-left text-white shadow-sm
                    transition-transform active:scale-[0.97]"
                >
                  <HandCoins
                    className="absolute -right-3 -bottom-3 size-24 opacity-15"
                    aria-hidden="true"
                  />
                  <span
                    className="flex size-10 items-center justify-center
                      rounded-full bg-white/20"
                  >
                    <Plus
                      className="size-5"
                      strokeWidth={2.75}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="relative mt-6">
                    <span className="block text-base font-black">new loan</span>
                    <span className="block text-xs font-semibold opacity-85">
                      pick a borrower, add an account
                    </span>
                  </span>
                </button>

                <Link
                  href="/daily-checklist"
                  className="flex items-center gap-3 rounded-2xl bg-card p-3
                    shadow-sm ring-1 ring-black/5 transition-transform
                    active:scale-[0.97] dark:ring-white/10"
                >
                  <span
                    className="relative flex size-10 shrink-0 items-center
                      justify-center rounded-full bg-amber-100 text-amber-600
                      dark:bg-amber-500/15 dark:text-amber-400"
                  >
                    <CalendarClock className="size-5" aria-hidden="true" />
                    {summary.duesTodaySchedules > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex h-5 min-w-5
                          items-center justify-center rounded-full bg-rose-500
                          px-1 text-[10px] font-bold text-white"
                      >
                        {summary.duesTodaySchedules}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-sm font-black
                        text-card-foreground/80"
                    >
                      due today
                    </span>
                    <span
                      className="block truncate text-xs font-semibold
                        text-muted-foreground tabular-nums"
                    >
                      {summary.duesTodaySchedules > 0
                        ? mask(formatPeso(summary.duesToday))
                        : "all clear"}
                    </span>
                  </span>
                </Link>

                <Link
                  href="/borrowers"
                  className="flex items-center gap-3 rounded-2xl bg-card p-3
                    shadow-sm ring-1 ring-black/5 transition-transform
                    active:scale-[0.97] dark:ring-white/10"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center
                      rounded-full bg-sky-100 text-sky-600 dark:bg-sky-500/15
                      dark:text-sky-400"
                  >
                    <Users className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-sm font-black
                        text-card-foreground/80"
                    >
                      borrowers
                    </span>
                    <span
                      className="block truncate text-xs font-semibold
                        text-muted-foreground tabular-nums"
                    >
                      {summary.activeBorrowers} active
                    </span>
                  </span>
                </Link>
              </div>
            )}
          </NewLoanFlow>

          <div>
            <p className="mb-2 px-1 text-sm font-bold text-card-foreground/80">
              For you today
            </p>
            <div
              className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1
                lg:mx-0 lg:flex-col lg:gap-2 lg:overflow-visible lg:px-0"
            >
              {banners.map((b) => (
                <Link
                  key={b.title}
                  href={b.href}
                  className={cn(
                    `relative w-56 shrink-0 snap-start overflow-hidden
                    rounded-2xl bg-linear-to-br p-4 transition-shadow
                    hover:shadow-md lg:flex lg:w-auto lg:items-center
                    lg:justify-between lg:gap-3 lg:px-4 lg:py-3`,
                    b.tone,
                  )}
                >
                  <b.icon
                    className="absolute -right-2 -bottom-2 size-20 opacity-15"
                    aria-hidden="true"
                  />
                  <div className="relative min-w-0">
                    <p className="text-base font-bold">{b.title}</p>
                    <p className="mt-0.5 text-xs font-semibold opacity-80">
                      {b.sub}
                    </p>
                  </div>
                  <span
                    className="relative mt-3 inline-block shrink-0 rounded-full
                      bg-white/70 lg:mt-0 px-3 py-1 text-xs font-bold
                      dark:bg-white/10"
                  >
                    Open
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <PaymentsCard payments={payments} mask={mask} />

          <OverdueCard
            buckets={overdueBuckets}
            total={agingTotal}
            topOverdue={topOverdue}
            mask={mask}
          />
        </div>
      </div>
    </div>
  );
}
