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

  const collectedWidth = Math.min(collectedPct, 100);
  const soFarWidth = Math.min(Math.max(soFarPct, collectedPct), 100);

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-amber-200/70
        bg-linear-to-br from-amber-50 via-card to-emerald-50 p-6 shadow-sm
        dark:border-border dark:from-amber-500/10 dark:via-card
        dark:to-emerald-500/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          icon={PiggyBank}
          tint="amber"
          title="monthly collections"
          subtitle="How this month is tracking"
        />
        <span
          className="rounded-full border border-amber-300/60 bg-white/70 px-3
            py-1 text-sm font-medium text-amber-800 dark:border-amber-500/30
            dark:bg-amber-500/10 dark:text-amber-300"
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
              "shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold",
              collectedPct >= 100
                ? "bg-emerald-600 text-white"
                : `bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`,
            )}
          >
            {collectedPct >= 100 ? "🎉 " : ""}
            {collectedPct}% collected
          </p>
        </div>

        {/* Two layers from the left: what's due so far, and on top what's collected. */}
        <div
          className="relative mt-4 h-4 w-full overflow-hidden rounded-full
            bg-white/80 ring-1 ring-black/5 ring-inset dark:bg-white/10
            dark:ring-white/5"
          role="progressbar"
          aria-label="Collected this month"
          aria-valuenow={collectedPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="dash-grow absolute inset-y-0 left-0 rounded-full
              bg-amber-300/70 bg-[repeating-linear-gradient(-45deg,transparent_0_6px,rgb(255_255_255/0.35)_6px_12px)]
              dark:bg-amber-400/40"
            style={{ width: `${soFarWidth}%` }}
          />
          <div
            className="dash-grow absolute inset-y-0 left-0 rounded-full
              bg-linear-to-r from-emerald-400 to-emerald-600 shadow-sm"
            style={{ width: `${collectedWidth}%` }}
          />
        </div>
        <div
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs
            text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            collected
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full bg-amber-300 dark:bg-amber-400/60"
              aria-hidden="true"
            />
            due so far · {soFarPct}%
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full bg-white ring-1 ring-black/10
                dark:bg-white/10 dark:ring-white/10"
              aria-hidden="true"
            />
            rest of month
          </span>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-lg border p-3 shadow-xs",
              stat.tone === "primary"
                ? `border-emerald-500/25 bg-emerald-50/80
                  dark:bg-emerald-500/10`
                : stat.tone === "accent"
                  ? "border-amber-500/25 bg-amber-50/80 dark:bg-amber-500/10"
                  : "border-black/5 bg-white/70 dark:border-white/5 dark:bg-white/5",
            )}
          >
            <dt className="text-xs font-medium lowercase text-muted-foreground">
              {stat.label}
            </dt>
            <dd
              className={
                "mt-1 text-lg font-semibold tracking-tight " +
                (stat.tone === "primary"
                  ? "text-emerald-700 dark:text-emerald-400"
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
