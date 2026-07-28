import { Users, CalendarClock, TrendingUp, ArrowUpRight } from "lucide-react";
import { formatPeso, type DashboardSummary } from "@/lib/dashboard-data";

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards = [
    {
      label: "active borrowers",
      value: summary.activeBorrowers.toLocaleString(),
      hint: `+${summary.activeBorrowersDelta} this week`,
      hintPositive: true,
      icon: Users,
    },
    {
      label: "dues today",
      value: formatPeso(summary.duesToday),
      hint: `${summary.duesTodaySchedules} schedules`,
      hintPositive: false,
      icon: CalendarClock,
    },
    {
      label: "avg monthly profit",
      value: formatPeso(summary.avgMonthlyProfit),
      hint: "6-month average",
      hintPositive: false,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span
              className="text-sm font-medium lowercase text-muted-foreground"
            >
              {card.label}
            </span>
            <span
              className="flex size-9 items-center justify-center rounded-lg
                bg-secondary text-primary"
            >
              <card.icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p
            className="mt-3 text-3xl font-semibold tracking-tight
              text-card-foreground text-balance"
          >
            {card.value}
          </p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            {card.hintPositive ? (
              <>
                <ArrowUpRight
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                <span className="font-medium text-primary">{card.hint}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{card.hint}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
