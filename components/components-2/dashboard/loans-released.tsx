"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPeso, type MonthlyProfit } from "@/lib/dashboard-data";
import {
  HeadlineStat,
  RangeToggle,
  TooltipCard,
  axisTick,
  pesoAxisTick,
  type RangeOption,
} from "./chart-bits";

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
        released{" "}
        <span className="font-medium text-popover-foreground">
          {formatPeso(d.released)}
        </span>
      </p>
      <p>
        {d.releasedCount} loan{d.releasedCount === 1 ? "" : "s"}
      </p>
    </TooltipCard>
  );
}

/** Principal lent out per month (by release date) — how fast capital is deployed. */
export function LoansReleased({ months }: { months: MonthlyProfit[] }) {
  const [range, setRange] = useState<RangeOption>(12);
  const data = months.slice(-range);
  const barSize = range === 6 ? 32 : 18;

  const total = data.reduce((s, m) => s + m.released, 0);
  const count = data.reduce((s, m) => s + m.releasedCount, 0);
  const profit = data.reduce((s, m) => s + m.actual, 0);

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            loans released
          </h2>
          <p className="text-sm text-muted-foreground">
            Principal lent out per month
          </p>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <HeadlineStat label="released" value={formatPeso(total)} />
        <HeadlineStat
          label="new loans"
          value={count.toLocaleString()}
          sub={count > 0 ? `avg ${formatPeso(total / count)}` : undefined}
        />
        <HeadlineStat
          label="profit / released"
          value={total > 0 ? `${Math.round((profit / total) * 100)}%` : "—"}
          sub="interest earned per ₱ lent"
        />
      </div>

      <div className="mt-5 h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
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
              cursor={{ fill: "var(--secondary)" }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="released"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              barSize={barSize}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
