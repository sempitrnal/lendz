import {
  Users,
  CalendarClock,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPeso, type DashboardSummary } from "@/lib/dashboard-data";

type Card = {
  label: string;
  value: string;
  hint: string;
  tone?: "positive" | "danger";
  icon: typeof Users;
  className?: string;
};

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const overduePct =
    summary.outstanding > 0
      ? Math.round((summary.overdue / summary.outstanding) * 100)
      : 0;

  const cards: Card[] = [
    {
      label: "outstanding",
      value: formatPeso(summary.outstanding),
      hint: `${summary.activeLoans} active loan${summary.activeLoans === 1 ? "" : "s"}`,
      icon: Wallet,
      className: "max-sm:col-span-2",
    },
    {
      label: "overdue",
      value: formatPeso(summary.overdue),
      hint:
        summary.overdue > 0
          ? `${overduePct}% of outstanding · ${summary.overdueBorrowers} borrower${summary.overdueBorrowers === 1 ? "" : "s"}`
          : "nothing past due",
      tone: summary.overdue > 0 ? "danger" : "positive",
      icon: AlertTriangle,
    },
    {
      label: "dues today",
      value: formatPeso(summary.duesToday),
      hint: `${summary.duesTodaySchedules} schedule${summary.duesTodaySchedules === 1 ? "" : "s"}`,
      icon: CalendarClock,
    },
    {
      label: "avg monthly profit",
      value: formatPeso(summary.avgMonthlyProfit),
      hint:
        summary.avgMonthlyProfitMonths > 0
          ? `last ${summary.avgMonthlyProfitMonths} full month${summary.avgMonthlyProfitMonths === 1 ? "" : "s"}`
          : "no full months yet",
      icon: TrendingUp,
    },
    {
      label: "active borrowers",
      value: summary.activeBorrowers.toLocaleString(),
      hint: `+${summary.activeBorrowersDelta} this week`,
      tone: summary.activeBorrowersDelta > 0 ? "positive" : undefined,
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5",
            card.className,
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className="text-sm font-medium lowercase text-muted-foreground"
            >
              {card.label}
            </span>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                card.tone === "danger"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-secondary text-primary",
              )}
            >
              <card.icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p
            className={cn(
              `mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums
              2xl:text-3xl`,
              card.tone === "danger"
                ? "text-rose-600 dark:text-rose-400"
                : "text-card-foreground",
            )}
          >
            {card.value}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs sm:text-sm">
            {card.tone === "positive" && card.label === "active borrowers" && (
              <ArrowUpRight
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "leading-snug",
                card.tone === "positive"
                  ? "font-medium text-primary"
                  : "text-muted-foreground",
              )}
            >
              {card.hint}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
