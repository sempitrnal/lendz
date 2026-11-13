"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
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
import { HIDDEN_AMOUNT } from "@/lib/hide-amounts";
import MonthPicker from "@/components/month-picker";
import { ReleaseCalendar } from "@/components/components-2/dashboard/release-calendar";
import { NewLoanFlow } from "@/components/components-2/dashboard/new-loan-flow";
import { ProfitCalendar } from "@/components/components-2/dashboard/profit-calendar";
import type { RecentPayment } from "@/components/components-2/dashboard/wallet-home";
import {
  OwingList,
  PaymentsCard,
} from "@/components/components-2/dashboard/dashboard-cards";

/**
 * The dashboard on a tablet or a laptop: the business's key figures in one
 * row on the green band, one large panel that switches between the profit
 * trend and the two calendars, and a rail of what needs doing today. The
 * phone keeps `WalletHome`'s single column; both show the same figures.
 */

const card =
  "rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10";

const BUCKET_COLORS = [
  "bg-amber-300",
  "bg-orange-300",
  "bg-rose-300",
  "bg-rose-400",
  "bg-red-500",
];

type Tab = "trend" | "profit" | "release";
const TABS: [Tab, string][] = [
  ["trend", "profit trend"],
  ["profit", "profit calendar"],
  ["release", "release calendar"],
];

/** A translucent figure tile on the band; a link when it leads somewhere. */
function Stat({
  label,
  value,
  hint,
  href,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  warn?: boolean;
}) {
  const body = (
    <>
      <p className="truncate text-[11px] font-semibold opacity-80">{label}</p>
      <p
        className={cn(
          "truncate text-xl font-black tracking-tight tabular-nums",
          warn && "text-amber-200",
        )}
      >
        {value}
      </p>
      <p className="truncate text-[11px] font-semibold opacity-80">{hint}</p>
    </>
  );
  const box = "block min-w-0 rounded-2xl bg-white/12 px-4 py-3";
  return href ? (
    <Link
      href={href}
      className={cn(box, "transition-colors hover:bg-white/20")}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

export function WalletDesktop({
  summary,
  currentMonth,
  activeMonth,
  profitPerMonth,
  overdueBuckets,
  topOverdue,
  payments,
  profitPerCategory,
  hide,
  onToggleHide,
}: {
  summary: DashboardSummary;
  currentMonth: CurrentMonthData;
  activeMonth: string;
  profitPerMonth: MonthlyProfit[];
  overdueBuckets: OverdueBucket[];
  topOverdue: OverdueBorrower[];
  payments: RecentPayment[];
  profitPerCategory: ProfitCategoryItem[];
  hide: boolean;
  onToggleHide(): void;
}) {
  const [tab, setTab] = useState<Tab>("trend");
  /** The bar the pointer is on; the last month otherwise. */
  const [hovered, setHovered] = useState<number | null>(null);
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);

  const collectedPct = currentMonth.toCollectThisMonth
    ? Math.min(
        100,
        Math.round(
          (currentMonth.collected / currentMonth.toCollectThisMonth) * 100,
        ),
      )
    : 0;
  const months = profitPerMonth;
  const maxProfit = Math.max(
    1,
    ...months.map((m) => Math.max(m.actual, m.expected)),
  );
  const thisMonth = months[months.length - 1];
  const shown = months[hovered ?? months.length - 1];
  const finished = months.filter((m) => !m.isFuture);
  const total = finished.reduce((sum, m) => sum + m.actual, 0);
  const expectedTotal = finished.reduce((sum, m) => sum + m.expected, 0);
  const best = months.reduce<MonthlyProfit | null>(
    (b, m) => (!b || m.actual > b.actual ? m : b),
    null,
  );
  const agingTotal = overdueBuckets.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="pb-6">
      {/* Full bleed: the band runs edge to edge under the green header (it
          cancels the page's side padding and top gap), with only its bottom
          corners rounded. Its content keeps the page's width. */}
      <div
        data-settle-group="band"
        className="relative -mx-4 text-white sm:-mt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <div className="relative mx-auto max-w-7xl px-5 pt-4 pb-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">utangz dashboard</p>
              <p className="text-xs font-semibold opacity-80">
                {currentMonth.label}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleHide}
              aria-label={hide ? "Show amounts" : "Hide amounts"}
              className="flex size-9 items-center justify-center rounded-full
                bg-white/15 transition-colors hover:bg-white/25"
            >
              {hide ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
            <NewLoanFlow>
              {({ open, warm }) => (
                <button
                  type="button"
                  onPointerDown={warm}
                  onClick={open}
                  className="flex items-center gap-1.5 rounded-full bg-white
                    px-4 py-2 text-sm font-black text-emerald-700 lowercase
                    shadow-sm transition-transform hover:scale-[1.03]
                    active:scale-[0.97]"
                >
                  <Plus className="size-4" strokeWidth={3} aria-hidden="true" />
                  new loan
                </button>
              )}
            </NewLoanFlow>
          </div>
          {/* The whole business in one row. */}
          <div className="mt-4 grid grid-cols-3 gap-3 lowercase xl:grid-cols-5">
            <Stat
              label="collected this month"
              value={mask(formatPeso(currentMonth.collected))}
              hint={`${collectedPct}% of ${mask(formatPeso(currentMonth.toCollectThisMonth))}`}
              href="/due-this-month"
            />
            <Stat
              label="profit this month"
              value={mask(formatPeso(currentMonth.profitCollected))}
              hint={
                thisMonth?.projected != null
                  ? `projected ${mask(formatPeso(thisMonth.projected))}`
                  : `${mask(formatPeso(currentMonth.remainingProfit))} still to come`
              }
            />
            <Stat
              label="outstanding"
              value={mask(formatPeso(summary.outstanding))}
              hint={`${summary.activeLoans} active loans`}
              href="/accounts"
            />
            <Stat
              label="overdue"
              value={mask(formatPeso(summary.overdue))}
              hint={`${summary.overdueBorrowers} borrowers`}
              href="/upcoming"
              warn={summary.overdue > 0}
            />
            <Stat
              label="due today"
              value={
                summary.duesTodaySchedules > 0
                  ? mask(formatPeso(summary.duesToday))
                  : "all clear"
              }
              hint={`${summary.duesTodaySchedules} still to collect`}
              href="/daily-checklist"
            />
          </div>
        </div>
      </div>

      <div
        className="mx-auto mt-4 grid max-w-7xl gap-4 px-1
          lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start
          xl:grid-cols-[minmax(0,1fr)_23rem]"
      >
        <div data-settle-group className="min-w-0 space-y-4">
          {/* One large panel; the calendars are tabs, not more cards. */}
          <div
            className="flex w-fit rounded-xl bg-secondary p-0.5 text-sm
              font-semibold lowercase"
            role="tablist"
          >
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-[10px] px-3 py-1.5 transition-colors",
                  tab === key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "trend" && shown && (
            <section className={cn(card, "p-5 lowercase")}>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {shown.month} · profit collected
                  </p>
                  <p
                    className="text-3xl font-black tracking-tight
                      text-card-foreground/80 tabular-nums"
                  >
                    {mask(formatPeso(shown.actual))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    expected
                  </p>
                  <p
                    className="text-lg font-bold text-muted-foreground
                      tabular-nums"
                  >
                    {mask(formatPeso(shown.expected))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    collected
                  </p>
                  <p
                    className="text-lg font-bold text-emerald-600 tabular-nums
                      dark:text-emerald-400"
                  >
                    {shown.percent}%
                  </p>
                </div>
                {shown.projected != null && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      projected
                    </p>
                    <p
                      className="text-lg font-bold text-card-foreground/80
                        tabular-nums"
                    >
                      {mask(formatPeso(shown.projected))}
                    </p>
                  </div>
                )}
                <div className="ml-auto">
                  <MonthPicker currentMonth={activeMonth} variant="card" />
                </div>
              </div>
              <div
                className="mt-5 flex h-56 items-end gap-2 lg:gap-3"
                onMouseLeave={() => setHovered(null)}
              >
                {months.map((m, i) => (
                  <button
                    key={m.key}
                    type="button"
                    onMouseEnter={() => setHovered(i)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${m.month}: ${formatPeso(m.actual)} of ${formatPeso(m.expected)}`}
                    className="group flex h-full min-w-0 flex-1 flex-col
                      items-center justify-end gap-1.5"
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
                    <span className="relative w-full flex-1">
                      {/* What the month was due to earn, behind what it did. */}
                      <span
                        className="absolute inset-x-0 bottom-0 rounded-t-lg
                          bg-amber-100 dark:bg-amber-500/10"
                        style={{ height: `${(m.expected / maxProfit) * 100}%` }}
                      />
                      <span
                        className={cn(
                          `absolute inset-x-0 bottom-0 rounded-t-lg
                          bg-linear-to-t transition-opacity
                          group-hover:opacity-80`,
                          m.isCurrent
                            ? "from-orange-500 to-amber-300"
                            : "from-amber-400 to-amber-200",
                        )}
                        style={{
                          height: `${Math.max(1, (m.actual / maxProfit) * 100)}%`,
                        }}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        hovered === i
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {m.short}
                    </span>
                  </button>
                ))}
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-3 border-t pt-4">
                {[
                  [`${months.length}-mo total`, mask(formatPeso(total))],
                  ["avg / month", mask(formatPeso(summary.avgMonthlyProfit))],
                  [
                    "best month",
                    best
                      ? `${best.short} · ${mask(formatPesoCompact(best.actual))}`
                      : "–",
                  ],
                  [
                    "collection rate",
                    expectedTotal > 0
                      ? `${Math.round((total / expectedTotal) * 100)}%`
                      : "–",
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt
                      className="text-[11px] font-semibold
                        text-muted-foreground"
                    >
                      {k}
                    </dt>
                    <dd
                      className="text-sm font-bold text-card-foreground/80
                        tabular-nums"
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {tab === "profit" && (
            <div className="max-w-3xl">
              <ProfitCalendar hide={hide} />
            </div>
          )}
          {tab === "release" && (
            <div className="max-w-3xl">
              <ReleaseCalendar hide={hide} />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <section className={cn(card, "p-5 lowercase")}>
              <h2 className="text-sm font-black text-card-foreground/80">
                {currentMonth.label} collections
              </h2>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-400
                    transition-[width] duration-700"
                  style={{ width: `${collectedPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                <span className="font-bold text-card-foreground/80 tabular-nums">
                  {mask(formatPeso(currentMonth.collected))}
                </span>{" "}
                of {mask(formatPeso(currentMonth.toCollectThisMonth))} ·{" "}
                {collectedPct}%
              </p>
              <dl className="mt-3 space-y-2 text-xs">
                {[
                  [
                    "profit collected (due this month)",
                    currentMonth.profitDueThisMonth,
                  ],
                  [
                    "total profit collected (this month)",
                    currentMonth.profitCollected,
                  ],
                  ["profit remaining", currentMonth.remainingProfit],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="font-semibold text-muted-foreground">{k}</dt>
                    <dd
                      className="font-bold text-card-foreground/80 tabular-nums"
                    >
                      {mask(formatPeso(v as number))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={cn(card, "p-5 lowercase")}>
              <h2 className="text-sm font-black text-card-foreground/80">
                overdue aging
              </h2>
              <div className="mt-3 space-y-2.5">
                {overdueBuckets.map((b, i) => (
                  <div
                    key={b.label}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span
                      className="w-20 shrink-0 font-semibold
                        text-muted-foreground"
                    >
                      {b.label}
                    </span>
                    <span className="h-2.5 flex-1 rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          BUCKET_COLORS[i % BUCKET_COLORS.length],
                        )}
                        style={{
                          width: `${agingTotal > 0 ? (b.amount / agingTotal) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span
                      className="w-20 text-right font-bold
                        text-card-foreground/80 tabular-nums"
                    >
                      {mask(formatPeso(b.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {profitPerCategory.length > 0 && (
              <section className={cn(card, "p-5 lowercase md:col-span-2")}>
                <h2 className="text-sm font-black text-card-foreground/80">
                  {currentMonth.label} profit by category
                </h2>
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="text-left text-[11px] text-muted-foreground">
                      <th className="pb-2 font-semibold">category</th>
                      <th className="pb-2 text-right font-semibold">
                        collected
                      </th>
                      <th className="pb-2 text-right font-semibold">
                        remaining
                      </th>
                      <th className="w-1/3 pb-2 pl-4 font-semibold">
                        progress
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {profitPerCategory.map((c) => (
                      <tr key={c.id ?? c.name}>
                        <td className="py-2">
                          <span className="flex items-center gap-2 font-bold">
                            <span
                              aria-hidden="true"
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: c.color ?? "#94a3b8" }}
                            />
                            {c.id ? (
                              <Link
                                href={`/categories/${c.id}`}
                                className="hover:underline"
                              >
                                {c.name}
                              </Link>
                            ) : (
                              c.name
                            )}
                          </span>
                        </td>
                        <td
                          className="py-2 text-right font-bold text-emerald-700
                            tabular-nums dark:text-emerald-400"
                        >
                          {mask(formatPeso(c.collectedProfit))}
                        </td>
                        <td className="py-2 text-right font-bold tabular-nums">
                          {mask(formatPeso(c.remainingProfit))}
                        </td>
                        <td className="py-2 pl-4">
                          <span className="block h-2 rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${c.profit > 0 ? (c.collectedProfit / c.profit) * 100 : 0}%`,
                                backgroundColor: c.color ?? "#94a3b8",
                              }}
                            />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </div>

        {/* The "today" rail: what needs doing, then what just happened. */}
        <aside
          data-settle-group
          className="grid gap-4 md:grid-cols-2 lg:sticky lg:top-22
            lg:grid-cols-1"
        >
          <section className={cn(card, "p-4 lowercase")}>
            <div className="flex items-center gap-2">
              <span
                className="flex size-8 items-center justify-center rounded-full
                  bg-amber-100 text-amber-700 dark:bg-amber-500/20
                  dark:text-amber-300"
              >
                <CalendarClock className="size-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-black text-card-foreground/80">
                today
              </h2>
            </div>
            <p
              className="mt-2 text-2xl font-black tracking-tight
                text-card-foreground/80 tabular-nums"
            >
              {summary.duesTodaySchedules > 0
                ? mask(formatPeso(summary.duesToday))
                : "all clear"}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {summary.duesTodaySchedules > 0
                ? `${summary.duesTodaySchedules} due today still to collect`
                : "nothing left to collect today"}
            </p>
            <Link
              href="/daily-checklist"
              className="mt-3 flex h-10 items-center justify-center gap-1
                rounded-lg bg-primary text-sm font-black text-primary-foreground
                transition-opacity hover:opacity-90"
            >
              open checklist
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </section>

          <section className={cn(card, "p-4 lowercase")}>
            <div className="flex items-center gap-2">
              <span
                className="flex size-8 items-center justify-center rounded-full
                  bg-rose-100 text-rose-700 dark:bg-rose-500/20
                  dark:text-rose-300"
              >
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-black text-card-foreground/80">
                most overdue
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
              {mask(formatPeso(summary.overdue))}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              owed by {summary.overdueBorrowers} borrower
              {summary.overdueBorrowers === 1 ? "" : "s"}
            </p>
            {topOverdue.length === 0 ? (
              <p
                className="py-4 text-center text-xs font-semibold
                  text-muted-foreground"
              >
                No overdue
              </p>
            ) : (
              <div className="mt-3 border-t pt-1">
                <OwingList topOverdue={topOverdue} mask={mask} />
              </div>
            )}
          </section>

          <div className="md:col-span-2 lg:col-span-1">
            <PaymentsCard payments={payments} mask={mask} />
          </div>
        </aside>
      </div>
    </div>
  );
}
