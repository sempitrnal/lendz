import { formatPeso, type CurrentMonthData } from "@/lib/dashboard-data";

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
      gradient:
        "bg-linear-to-br from-sky-50/70 to-sky-100/80 dark:from-sky-950/40 dark:to-sky-900/30",
    },
    {
      label: "collected",
      value: currentMonth.collected,
      tone: "primary",
      gradient:
        "bg-linear-to-br from-emerald-50/70 to-emerald-100/80 dark:from-emerald-950/40 dark:to-emerald-900/30",
    },
    {
      label: "meme",
      value: currentMonth.meme,
      tone: "default",
      gradient:
        "bg-linear-to-br from-amber-50/70 to-amber-100/80 dark:from-amber-950/40 dark:to-amber-900/30",
    },
    {
      label: "expected profit",
      value: currentMonth.expectedProfit,
      tone: "default",
      gradient:
        "bg-linear-to-br from-violet-50/70 to-violet-100/80 dark:from-violet-950/40 dark:to-violet-900/30",
    },
    {
      label: "remaining profit",
      value: currentMonth.remainingProfit,
      tone: "accent",
      gradient:
        "bg-linear-to-br from-rose-50/70 to-rose-100/80 dark:from-rose-950/40 dark:to-rose-900/30",
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            monthly collections
          </h2>
          <p className="text-sm text-muted-foreground">{currentMonth.label}</p>
        </div>
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
          <p className="text-sm font-medium text-primary">
            {collectedPct}% collected
          </p>
        </div>

        <div
          className="mt-4 h-3 w-full overflow-hidden rounded-full bg-secondary"
        >
          <div className="flex h-full">
            <div
              className="h-full bg-primary"
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
          <div key={stat.label} className={`rounded-lg ${stat.gradient} p-3`}>
            <dt className="text-xs font-medium lowercase text-muted-foreground">
              {stat.label}
            </dt>
            <dd
              className={
                "mt-1 text-lg font-semibold tracking-tight " +
                (stat.tone === "primary"
                  ? "text-primary"
                  : stat.tone === "accent"
                    ? "text-accent-foreground"
                    : "text-card-foreground")
              }
            >
              {formatPeso(stat.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
