"use client";

import { useId, useState } from "react";
import { Coins } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatPeso, type MonthlyProfit } from "@/lib/dashboard-data";
import { SectionHeading } from "./section-heading";
import {
  BarGradient,
  HeadlineStat,
  RangeToggle,
  TooltipCard,
  axisTick,
  chartCursor,
  pesoAxisTick,
  type RangeOption,
} from "./chart-bits";

interface ProfitPerMonthProps {
  profitPerMonth: MonthlyProfit[];
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyProfit }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipCard title={d.month}>
      <p>
        profit{" "}
        <span className="font-medium text-popover-foreground">
          {formatPeso(d.actual)}
        </span>
      </p>
      <p>
        expected{" "}
        <span className="font-medium text-popover-foreground">
          {formatPeso(d.expected)}
        </span>{" "}
        · {d.percent}%
      </p>
      <p>
        collected{" "}
        <span className="font-medium text-popover-foreground">
          {formatPeso(d.collected)}
        </span>{" "}
        of {formatPeso(d.due)}
      </p>
    </TooltipCard>
  );
}

/** Month tiles go green → amber → rose as less of the expected profit came in. */
function percentTone(m: MonthlyProfit) {
  if (m.isFuture)
    return "border-black/5 bg-white/60 text-muted-foreground dark:border-white/5 dark:bg-white/5";
  if (m.isCurrent)
    return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (m.percent >= 80)
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (m.percent >= 60)
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function ProfitPerMonth({ profitPerMonth }: ProfitPerMonthProps) {
  const [range, setRange] = useState<RangeOption>(6);
  const data = profitPerMonth.slice(-range);
  const barSize = range === 6 ? 32 : 18;
  const gradId = useId();

  const total = data.reduce((s, m) => s + m.actual, 0);
  const totalExpected = data.reduce((s, m) => s + m.expected, 0);
  const current = data[data.length - 1];
  const previous = data[data.length - 2];
  // A month still in progress would always look like a drop vs a full month.
  const momDelta =
    current && !current.isCurrent && previous && previous.actual > 0
      ? Math.round(((current.actual - previous.actual) / previous.actual) * 100)
      : null;
  const best = data.reduce<MonthlyProfit | null>(
    (b, m) => (m.actual > (b?.actual ?? 0) ? m : b),
    null,
  );

  return (
    <section
      className="rounded-xl border border-emerald-100 bg-linear-to-br
        from-emerald-50/60 via-card to-teal-50/60 p-6 shadow-sm
        dark:border-border dark:from-emerald-500/5 dark:via-card
        dark:to-teal-500/5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          icon={Coins}
          tint="emerald"
          title="profit per month"
          subtitle="Interest collected vs expected"
        />
        <RangeToggle value={range} onChange={setRange} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <HeadlineStat
          label={`${range}-month total`}
          value={formatPeso(total)}
          sub={
            totalExpected > 0
              ? `${Math.round((total / totalExpected) * 100)}% of ${formatPeso(totalExpected)}`
              : undefined
          }
        />
        <HeadlineStat
          label={current ? current.short.toLowerCase() : "this month"}
          value={formatPeso(current?.actual ?? 0)}
          sub={
            current?.isCurrent
              ? `in progress · ${current.percent}% of expected`
              : momDelta === null
                ? undefined
                : `${momDelta >= 0 ? "+" : ""}${momDelta}% vs ${previous!.short}`
          }
          subTone={
            momDelta === null ? undefined : momDelta >= 0 ? "up" : "down"
          }
        />
        <HeadlineStat
          label="monthly average"
          value={formatPeso(data.length ? total / data.length : 0)}
        />
        <HeadlineStat
          label="best month"
          value={best ? formatPeso(best.actual) : "—"}
          sub={best?.month}
        />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
          collected profit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-border" aria-hidden="true" />
          expected
        </span>
      </div>

      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barGap={-barSize}
          >
            <BarGradient id={gradId} color="var(--primary)" />
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="short"
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tick={axisTick}
              tickFormatter={pesoAxisTick}
            />
            <Tooltip
              cursor={chartCursor}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="expected"
              fill="var(--border)"
              radius={[6, 6, 0, 0]}
              barSize={barSize}
              isAnimationActive={false}
            />
            <Bar
              dataKey="actual"
              fill={`url(#${gradId})`}
              radius={[6, 6, 0, 0]}
              barSize={barSize}
              animationDuration={700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className={cn(
          "mt-4 grid grid-cols-6 gap-1.5",
          range === 12 && "sm:grid-cols-12",
        )}
      >
        {data.map((m) => (
          <div
            key={m.key}
            className={cn(
              "rounded-lg border px-1 py-1.5 text-center",
              percentTone(m),
            )}
            title={`${m.month}: ${m.percent}% of expected profit collected`}
          >
            <p className="text-[11px] font-medium opacity-75">{m.short}</p>
            <p className="text-xs font-semibold tabular-nums">
              {m.isFuture ? "—" : `${m.percent}%`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
