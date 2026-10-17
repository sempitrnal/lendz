import { PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPeso, type CurrentMonthData } from "@/lib/dashboard-data";
import { SectionHeading } from "./section-heading";
import { CelebrateWhen } from "./celebrate-when";

export function MonthlyCollections({
  currentMonth,
}: {
  currentMonth: CurrentMonthData;
}) {
  const collectedPct = currentMonth.toCollectThisMonth
    ? Math.round(
        (currentMonth.collected / currentMonth.toCollectThisMonth) * 100,
      )
    : 0;
  const soFarPct = currentMonth.toCollectThisMonth
    ? Math.round(
        (currentMonth.toCollectSoFar / currentMonth.toCollectThisMonth) * 100,
      )
    : 0;

  const stats = [
    {
      label: "to collect so far",
      value: currentMonth.toCollectSoFar,
      tone: "accent",
  
    },
    {
      label: "collected",
      value: currentMonth.collected,
      tone: "primary",
 
    },
    {
      label: "meme",
      value: currentMonth.meme,
      tone: "default",
 
    },
    {
      label: "expected profit",
      value: currentMonth.expectedProfit,
      tone: "default",

    },
    {
      label: "remaining profit",
      value: currentMonth.remainingProfit,
      tone: "accent",

    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          icon={PiggyBank}
          tint="amber"
          title="monthly collections"
          subtitle="How this month is tracking"
        />
        <span
          className="rounded-full border border-border bg-secondary px-3 py-1
            text-sm font-medium text-secondary-foreground"
        >
          {currentMonth.label}
        </span>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              to collect this month
            </p>
            <p
              className="mt-1 text-4xl font-semibold tracking-tight
                text-card-foreground text-balance"
            >
              {formatPeso(currentMonth.toCollectThisMonth)}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-sm font-medium",
              collectedPct >= 100
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {collectedPct >= 100 ? "🎉 " : ""}
            {collectedPct}% collected
          </p>
        </div>

        <div
          className="mt-4 h-3 w-full overflow-hidden rounded-full bg-secondary"
        >
          <div className="dash-grow flex h-full">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary/70
                to-primary"
              style={{ width: `${collectedPct}%` }}
              aria-hidden="true"
            />
            <div
              className="h-full bg-primary/40"
              style={{ width: `${Math.max(soFarPct - collectedPct, 0)}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-lg border p-3",
              stat.tone === "primary"
                ? "border-primary/20 bg-primary/5"
                : stat.tone === "accent"
                  ? "border-amber-500/20 bg-amber-500/5"
                  : "border-transparent bg-secondary/60",
            )}
          >
            <dt className="text-xs font-medium lowercase text-muted-foreground">
              {stat.label}
            </dt>
            <dd
              className={
                "mt-1 text-lg font-semibold tracking-tight " +
                (stat.tone === "primary"
                  ? "text-primary"
                  : stat.tone === "accent"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-card-foreground")
              }
            >
              {formatPeso(stat.value)}
            </dd>
          </div>
        ))}
      </dl>
      <CelebrateWhen
        when={collectedPct >= 100}
        onceKey={`collected-${currentMonth.label}`}
      />
    </section>
  );
}
