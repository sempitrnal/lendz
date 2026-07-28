"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPeso, type MonthlyProfit } from "@/lib/dashboard-data";

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
    <div
      className="rounded-lg border border-border bg-popover px-3 py-2 text-sm
        shadow-md"
    >
      <p className="font-medium text-popover-foreground">{d.month}</p>
      <p className="mt-1 text-muted-foreground">
        actual{" "}
        <span className="font-medium text-primary">{formatPeso(d.actual)}</span>
      </p>
      <p className="text-muted-foreground">
        expected{" "}
        <span className="font-medium text-popover-foreground">
          {formatPeso(d.expected)}
        </span>{" "}
        · {d.percent}%
      </p>
    </div>
  );
}

export function ProfitPerMonth({ profitPerMonth }: ProfitPerMonthProps) {
  const activeShort = profitPerMonth[profitPerMonth.length - 1]?.short ?? "";

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">
          profit per month
        </h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm bg-primary"
              aria-hidden="true"
            />
            actual
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm bg-border"
              aria-hidden="true"
            />
            expected
          </span>
        </div>
      </div>

      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={profitPerMonth}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="short"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
            />
            <Tooltip
              cursor={{ fill: "var(--secondary)" }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="expected"
              fill="var(--border)"
              radius={[4, 4, 0, 0]}
              barSize={18}
            />
            <Bar dataKey="actual" radius={[4, 4, 0, 0]} barSize={18}>
              {profitPerMonth.map((entry) => (
                <Cell
                  key={entry.short}
                  fill={
                    entry.short === activeShort
                      ? "var(--chart-3)"
                      : "var(--primary)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {profitPerMonth.map((m) => (
          <div
            key={m.month}
            className="rounded-lg bg-secondary/60 p-2 text-center"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {m.short}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-card-foreground">
              {m.percent}%
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
