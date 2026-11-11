"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { CalendarHeart, ChevronLeft, ChevronRight, Crown } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { principalShare, type AccountTerms } from "@/lib/checklist/profit";
import {
  compactAmount,
  dailyProfit,
  monthBounds,
  monthGrid,
  shiftMonth,
  type CalendarPayment,
  type DayFigure,
} from "@/lib/dashboard/daily-profit";
import { formatPeso } from "@/lib/dashboard-data";
import { HIDDEN_AMOUNT } from "@/lib/hide-amounts";

/**
 * The dashboard's profit calendar: a month laid out like a fare calendar,
 * each day showing the profit collected on it, shaded by how good the day
 * was. Tapping a day shows its figures underneath.
 */

type Embedded<T> = T | T[] | null;
const one = <T,>(value: Embedded<T>): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

type PaymentRow = {
  id: string;
  schedule_id: string;
  amount: number | null;
  payment_date: string;
  created_at: string | null;
  payment_schedules: Embedded<{
    due_date: string | null;
    accounts: Embedded<AccountTerms>;
  }>;
};

/** Ids per request: a month's schedules don't fit in one address. */
const ID_BATCH = 100;

async function loadMonth(month: string): Promise<Record<string, DayFigure>> {
  const [from, to] = monthBounds(month);
  const inMonth = await supabase
    .from("schedule_payments")
    .select(
      "id, schedule_id, amount, payment_date, created_at, payment_schedules!inner(due_date, accounts!inner(principal_amount, term_months, payment_frequency, term_installments, schedule_mode, deleted_at))",
    )
    .gte("payment_date", from)
    .lt("payment_date", to)
    .is("payment_schedules.accounts.deleted_at", null)
    .range(0, 4999);
  if (inMonth.error) throw new Error(inMonth.error.message);
  const rows = (inMonth.data ?? []) as unknown as PaymentRow[];
  if (rows.length === 0) return {};

  // What each of those schedules had been paid before the month began.
  const ids = [...new Set(rows.map((r) => r.schedule_id))];
  const before = new Map<string, number>();
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const earlier = await supabase
      .from("schedule_payments")
      .select("schedule_id, amount")
      .in("schedule_id", ids.slice(i, i + ID_BATCH))
      .lt("payment_date", from)
      .range(0, 9999);
    if (earlier.error) throw new Error(earlier.error.message);
    for (const p of earlier.data ?? []) {
      const id = String(p.schedule_id);
      before.set(id, (before.get(id) ?? 0) + Number(p.amount ?? 0));
    }
  }

  const shares = new Map<string, number>();
  const payments: CalendarPayment[] = [];
  for (const r of rows) {
    const account = one(one(r.payment_schedules)?.accounts ?? null);
    if (account) shares.set(r.schedule_id, principalShare(account));
    payments.push({
      id: r.id,
      scheduleId: r.schedule_id,
      date: r.payment_date.slice(0, 10),
      amount: Number(r.amount ?? 0),
      createdAt: r.created_at,
      dueDate: one(r.payment_schedules)?.due_date ?? null,
    });
  }
  return dailyProfit(payments, before, shares);
}

const manilaToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const WEEKDAYS = ["s", "m", "t", "w", "t", "f", "s"];

/** Cell shading from a quiet day to the month's best, lightest first. */
const HEAT = [
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/35 dark:text-emerald-100",
  "bg-emerald-300 text-emerald-950 dark:bg-emerald-500/55 dark:text-white",
];

function monthLabel(month: string) {
  const [y, mo] = month.split("-").map(Number);
  return new Date(y, mo - 1, 1)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toLowerCase();
}

function dayLabel(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d)
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toLowerCase();
}

export function ProfitCalendar({ hide }: { hide: boolean }) {
  const today = manilaToday();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  /** Which way the month last moved, for the slide. */
  const [direction, setDirection] = useState(1);
  const [picked, setPicked] = useState<string | null>(today);

  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard-profit-calendar", month],
    queryFn: () => loadMonth(month),
    staleTime: 60_000,
  });

  const days = data ?? {};
  const figures = Object.values(days);
  const total = figures.reduce((sum, f) => sum + f.profit, 0);
  // Profit on installments that weren't due this month (late or paid ahead):
  // the gap between this total and the dashboard's by-due-month figures.
  const otherMonths = figures.reduce((sum, f) => sum + f.otherMonths, 0);
  const otherPct = total > 0 ? Math.round((otherMonths / total) * 100) : 0;
  const best = Object.entries(days).reduce<[string, DayFigure] | null>(
    (top, entry) =>
      entry[1].profit > 0 && (!top || entry[1].profit > top[1].profit)
        ? entry
        : top,
    null,
  );
  const max = best?.[1].profit ?? 0;
  const earningDays = figures.filter((f) => f.profit > 0).length;

  const move = (by: number) => {
    const next = shiftMonth(month, by);
    setDirection(by);
    setMonth(next);
    // Today when it is in view; otherwise nothing until a day is tapped.
    setPicked(next === thisMonth ? today : null);
  };

  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  const pickedFigure = picked ? days[picked] : undefined;

  return (
    <section
      aria-label="Profit calendar"
      className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1
        ring-black/5 lowercase dark:ring-white/10"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center
            rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20
            dark:text-emerald-300"
        >
          <CalendarHeart className="size-4" aria-hidden="true" />
        </span>
        <h2
          className="text-sm font-black whitespace-nowrap
            text-card-foreground/80"
        >
          profit calendar
        </h2>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => move(-1)}
            className="flex size-8 items-center justify-center rounded-full
              text-muted-foreground active:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            className="min-w-[4.5rem] text-center text-xs font-bold
              text-card-foreground/80"
          >
            {monthLabel(month)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => move(1)}
            className="flex size-8 items-center justify-center rounded-full
              text-muted-foreground active:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-4 pb-3">
        <div>
          <p
            className="text-2xl font-bold tracking-tight text-card-foreground/80
              tabular-nums"
          >
            {isPending ? "…" : mask(formatPeso(total))}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            profit collected · {earningDays} day{earningDays === 1 ? "" : "s"}
          </p>
          {otherMonths > 0 && (
            <p
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full
                bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800
                dark:bg-sky-500/15 dark:text-sky-300"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-sky-500"
              />
              {mask(formatPeso(otherMonths))} not due in{" "}
              {monthLabel(month).split(" ")[0]}
              {hide ? "" : ` · ${otherPct}%`}
            </p>
          )}
        </div>
        {best && (
          <button
            type="button"
            onClick={() => setPicked(best[0])}
            className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5
              py-1 text-[11px] font-bold text-amber-800 active:bg-amber-200
              dark:bg-amber-500/15 dark:text-amber-300"
          >
            <Crown className="size-3" aria-hidden="true" />
            best {Number(best[0].slice(8))} ·{" "}
            {hide ? "•••" : compactAmount(best[1].profit)}
          </button>
        )}
      </div>

      <div className="px-3 pb-3">
        <div
          className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px]
            font-bold text-muted-foreground"
          aria-hidden="true"
        >
          {WEEKDAYS.map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>

        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <m.div
            key={month}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
              shown: { x: 0, opacity: 1 },
              exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="shown"
            exit="exit"
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className={cn("space-y-1", isPending && "animate-pulse")}
          >
            {monthGrid(month).map((week, w) => (
              <div key={w} className="grid grid-cols-7 gap-1">
                {week.map((date, d) => {
                  if (!date) return <span key={d} />;
                  const figure = days[date];
                  const profit = figure?.profit ?? 0;
                  const future = date > today;
                  const isBest = best?.[0] === date;
                  const level =
                    profit > 0 && max > 0
                      ? Math.min(3, Math.floor((profit / max) * 4))
                      : -1;
                  const on = picked === date;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={future}
                      aria-pressed={on}
                      aria-label={`${dayLabel(date)}, ${
                        hide ? "hidden" : formatPeso(profit)
                      } profit`}
                      onClick={() => setPicked(date)}
                      className={cn(
                        `relative flex h-12 flex-col items-center justify-center
                        rounded-xl transition-transform active:scale-90`,
                        level >= 0
                          ? HEAT[level]
                          : "bg-muted/40 text-muted-foreground",
                        future && "bg-transparent opacity-35",
                        on &&
                          `ring-2 ring-emerald-500 ring-offset-1
                          ring-offset-card`,
                      )}
                    >
                      {isBest && (
                        <Crown
                          aria-hidden="true"
                          className="absolute -top-1 -right-1 size-3.5
                            rounded-full bg-amber-400 p-0.5 text-white"
                        />
                      )}
                      <span
                        className={cn(
                          "text-[10px] leading-none font-bold opacity-70",
                          date === today &&
                            `rounded-full bg-emerald-600 px-1.5 py-0.5
                            text-white opacity-100`,
                        )}
                      >
                        {Number(date.slice(8))}
                      </span>
                      <span
                        className="mt-1 text-[11px] leading-none font-black
                          tabular-nums"
                      >
                        {future
                          ? ""
                          : profit > 0
                            ? hide
                              ? "•••"
                              : compactAmount(profit)
                            : "–"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </m.div>
        </AnimatePresence>

        {isError && !data && (
          <p className="pt-2 text-center text-xs font-semibold text-rose-500">
            couldn&apos;t load this month. try again when online.
          </p>
        )}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {picked && (
          <m.div
            key={picked}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-between gap-3 border-t
              border-border bg-muted/30 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-card-foreground/80">
                {dayLabel(picked)}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {pickedFigure
                  ? `${pickedFigure.payments} payment${
                      pickedFigure.payments === 1 ? "" : "s"
                    } · ${mask(formatPeso(pickedFigure.collected))} collected${
                      pickedFigure.otherMonths > 0
                        ? ` · ${mask(formatPeso(pickedFigure.otherMonths))} profit not due this month`
                        : ""
                    }`
                  : "no payments recorded"}
              </p>
            </div>
            <p
              className="shrink-0 text-lg font-bold text-emerald-600
                tabular-nums dark:text-emerald-300"
            >
              {mask(`+${formatPeso(pickedFigure?.profit ?? 0)}`)}
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
