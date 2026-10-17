import type { CSSProperties } from "react";
import {
  Users,
  CalendarClock,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type DashboardSummary } from "@/lib/dashboard-data";

import { CountUp } from "./count-up";

type Tint = "hero" | "rose" | "amber" | "sky" | "violet";

type Card = {
  label: string;
  value: number;
  format?: "peso" | "number";
  hint: string;
  tone?: "positive" | "danger";
  tint: Tint;
  icon: typeof Users;
  className?: string;
};

// Each metric gets its own soft hue so the row scans at a glance.
const TINTS: Record<Exclude<Tint, "hero">, { badge: string; glow: string }> = {
  rose: {
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    glow: "from-rose-500/10",
  },
  amber: {
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    glow: "from-amber-500/10",
  },
  sky: {
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    glow: "from-sky-500/10",
  },
  violet: {
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    glow: "from-violet-500/10",
  },
};

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const overduePct =
    summary.outstanding > 0
      ? Math.round((summary.overdue / summary.outstanding) * 100)
      : 0;

  const cards: Card[] = [
    {
      label: "outstanding",
      value: summary.outstanding,
      hint: `${summary.activeLoans} active loan${summary.activeLoans === 1 ? "" : "s"}`,
      tint: "hero",
      icon: Wallet,
      className: "max-sm:col-span-2",
    },
    {
      label: "overdue",
      value: summary.overdue,
      hint:
        summary.overdue > 0
          ? `${overduePct}% of outstanding · ${summary.overdueBorrowers} borrower${summary.overdueBorrowers === 1 ? "" : "s"}`
          : "nothing past due",
      tone: summary.overdue > 0 ? "danger" : "positive",
      tint: "rose",
      icon: AlertTriangle,
    },
    {
      label: "dues today",
      value: summary.duesToday,
      hint: `${summary.duesTodaySchedules} schedule${summary.duesTodaySchedules === 1 ? "" : "s"}`,
      tint: "amber",
      icon: CalendarClock,
    },
    {
      label: "avg monthly profit",
      value: summary.avgMonthlyProfit,
      hint:
        summary.avgMonthlyProfitMonths > 0
          ? `last ${summary.avgMonthlyProfitMonths} full month${summary.avgMonthlyProfitMonths === 1 ? "" : "s"}`
          : "no full months yet",
      tint: "sky",
      icon: TrendingUp,
    },
    {
      label: "active borrowers",
      value: summary.activeBorrowers,
      format: "number",
      hint: `+${summary.activeBorrowersDelta} this week`,
      tone: summary.activeBorrowersDelta > 0 ? "positive" : undefined,
      tint: "violet",
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, i) => {
        const hero = card.tint === "hero";
        const tint = card.tint === "hero" ? null : TINTS[card.tint];
        return (
          <div
            key={card.label}
            style={{ "--rise-i": i } as CSSProperties}
            className={cn(
              `dash-rise relative min-w-0 overflow-hidden rounded-xl border p-4
              shadow-sm transition-[translate,box-shadow] duration-200
              hover:-translate-y-0.5 hover:shadow-md sm:p-5`,
              hero
                ? `border-primary bg-primary text-primary-foreground dark:border-white/15
                  dark:bg-secondary dark:bg-linear-to-br dark:from-white/10 dark:to-white/4
                  dark:text-foreground`
                : "border-border bg-card",
              card.className,
            )}
          >
            {/* Soft corner wash in the card's hue; purely decorative. */}
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -top-10 -right-10 size-32 rounded-full",
                hero
                  ? "bg-primary-foreground/10 dark:bg-white/5"
                  : `bg-linear-to-bl ${tint!.glow} to-transparent`,
              )}
            />
            <div className="relative flex items-start justify-between gap-2">
              <span
                className={cn(
                  "text-sm font-medium lowercase",
                  hero
                  ? "text-primary-foreground/80 dark:text-muted-foreground"
                  : "text-muted-foreground",
                )}
              >
                {card.label}
              </span>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  hero ? "bg-primary-foreground/15 dark:bg-white/10" : tint!.badge,
                )}
              >
                <card.icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p
              className={cn(
                `relative mt-3 truncate text-2xl font-semibold tracking-tight
                tabular-nums 2xl:text-3xl`,
                hero
                  ? "text-primary-foreground dark:text-foreground"
                  : card.tone === "danger"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-card-foreground",
              )}
            >
              <CountUp value={card.value} format={card.format} />
            </p>
            <div className="relative mt-2 flex items-center gap-1 text-xs sm:text-sm">
              {card.tone === "positive" && card.label === "active borrowers" && (
                <ArrowUpRight
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "leading-snug",
                  hero
                    ? "text-primary-foreground/80 dark:text-muted-foreground"
                    : card.tone === "positive"
                      ? "font-medium text-primary"
                      : "text-muted-foreground",
                )}
              >
                {card.hint}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
