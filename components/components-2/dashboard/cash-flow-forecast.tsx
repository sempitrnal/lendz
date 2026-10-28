"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPeso, type CashFlowWeek } from "@/lib/dashboard-data";
import { useId } from "react";
import { Banknote } from "lucide-react";
import {
  BarGradient,
  HeadlineStat,
  TooltipCard,
  axisTick,
  chartCursor,
  pesoAxisTick,
} from "./chart-bits";
import { SectionHeading } from "./section-heading";
import { DashCard } from "./dash-card";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CashFlowWeek }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipCard title={d.range}>
      <p>
        expected{" "}
        <span className="font-medium text-popover-foreground">
          {formatPeso(d.expected)}
        </span>
      </p>
      <p>
        {d.count} schedule{d.count === 1 ? "" : "s"}
      </p>
    </TooltipCard>
  );
}

/** Unpaid amounts due from today through the next 8 weeks, bucketed by week. */
export function CashFlowForecast({ weeks }: { weeks: CashFlowWeek[] }) {
  const total = weeks.reduce((s, w) => s + w.expected, 0);
  const next4 = weeks.slice(0, 4).reduce((s, w) => s + w.expected, 0);
  const thisWeek = weeks[0];
  const gradId = useId();

  return (
    <DashCard className="rounded-xl border border-border bg-card p-6">
      <SectionHeading
        icon={Banknote}
        tint="emerald"
        title="incoming cash"
        subtitle={`Unpaid dues for the next ${weeks.length} weeks (overdue not included)`}
      />

      <div className="mt-5 grid grid-cols-3 gap-4">
        <HeadlineStat
          label="this week"
          value={formatPeso(thisWeek?.expected ?? 0)}
          sub={thisWeek ? `${thisWeek.count} schedules` : undefined}
        />
        <HeadlineStat label="next 4 weeks" value={formatPeso(next4)} />
        <HeadlineStat
          label={`next ${weeks.length} weeks`}
          value={formatPeso(total)}
        />
      </div>

      <div className="mt-5 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={weeks}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
          >
            <BarGradient id={gradId} color="var(--primary)" />
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
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
            <Tooltip cursor={chartCursor} content={<ChartTooltip />} />
            <Bar
              dataKey="expected"
              fill={`url(#${gradId})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
              animationDuration={700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashCard>
  );
}
