"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";
import { useTheme } from "next-themes";
import { useMemo } from "react";

export type CashFlowWeek = {
  label: string;
  weekRange: string;
  expected: number;
  count: number;
  isCurrentWeek: boolean;
};

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}K`;
  return `₱${v.toLocaleString()}`;
}

function NeoBrutalBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  isCurrent?: boolean;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#6ee7b7" } = props;
  if (width <= 0 || height <= 0) return null;
  const shadow = 3;
  return (
    <g>
      <rect
        x={x + shadow}
        y={y + shadow}
        width={width}
        height={height}
        fill="#0f172a"
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#0f172a"
        strokeWidth={2}
      />
    </g>
  );
}

function CustomBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isCurrentWeek?: any;
}) {
  const { isCurrentWeek, ...rest } = props;
  return (
    <NeoBrutalBar {...rest} fill={isCurrentWeek ? "#6ee7b7" : "#a5f3fc"} />
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const expected = payload.find((p) => p.dataKey === "expected")?.value ?? 0;
  const count = payload[0]?.payload?.count ?? 0;
  const fullLabel = payload[0]?.payload?.weekRange ?? label;
  return (
    <div
      style={{
        border: "2px solid #0f172a",
        boxShadow: "4px 4px 0px 0px #0f172a",
        backgroundColor: "#fff",
        padding: "10px 14px",
        fontFamily: "inherit",
        minWidth: 170,
      }}
    >
      <p
        style={{
          fontWeight: 900,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
          color: "#0f172a",
        }}
      >
        {fullLabel}
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        <span style={{ color: "#475569" }}>Expected</span>
        <span style={{ color: "#0f172a" }}>₱{expected.toLocaleString()}</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span style={{ color: "#475569" }}>Schedules</span>
        <span style={{ color: "#0f172a" }}>{count}</span>
      </div>
    </div>
  );
}

export default function CashFlowForecastChart({
  data,
}: {
  data: CashFlowWeek[];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const axisStroke = isDark ? "#30363d" : "#0f172a";
  const tickFill = isDark ? "#c9d1d9" : "#0f172a";
  const mutedFill = isDark ? "#8b949e" : "#64748b";

  const totalForecast = useMemo(
    () => data.reduce((s, w) => s + w.expected, 0),
    [data],
  );
  const peakWeek = useMemo(
    () => data.reduce((a, b) => (b.expected > a.expected ? b : a), data[0]),
    [data],
  );
  const totalSchedules = useMemo(
    () => data.reduce((s, w) => s + w.count, 0),
    [data],
  );
  const activeWeeks = useMemo(
    () => data.filter((w) => w.count > 0).length,
    [data],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p
          className="text-[10px] font-black uppercase tracking-widest
            text-slate-500 dark:text-muted-foreground"
        >
          30-day cash flow forecast
        </p>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold
              text-slate-500 dark:text-muted-foreground"
          >
            <span
              className="inline-block size-2.5 border border-slate-900
                bg-emerald-300 dark:border-border"
            />
            this week
          </span>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold
              text-slate-500 dark:text-muted-foreground"
          >
            <span
              className="inline-block size-2.5 border border-slate-900
                bg-cyan-200 dark:border-border"
            />
            upcoming
          </span>
        </div>
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="28%"
          >
            <XAxis
              dataKey="label"
              tick={{
                fontSize: 11,
                fontWeight: 900,
                fill: tickFill,
                fontFamily: "inherit",
              }}
              axisLine={{ stroke: axisStroke, strokeWidth: 2 }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(Number(v))}
              tick={{
                fontSize: 9,
                fontWeight: 700,
                fill: mutedFill,
                fontFamily: "inherit",
              }}
              axisLine={{ stroke: axisStroke, strokeWidth: 2 }}
              tickLine={false}
              width={52}
            />
            <Tooltip
              cursor={{
                fill: "rgba(15,23,42,0.04)",
                stroke: "#0f172a",
                strokeWidth: 1,
              }}
              content={<CustomTooltip />}
            />
            {totalForecast > 0 && (
              <ReferenceLine
                y={totalForecast / data.filter((d) => d.expected > 0).length}
                stroke={isDark ? "#4b5563" : "#94a3b8"}
                strokeDasharray="5 3"
                strokeWidth={1.5}
              />
            )}
            <Bar dataKey="expected" maxBarSize={56} shape={<CustomBar />}>
              <LabelList
                dataKey="count"
                position="top"
                formatter={(v: unknown) => (Number(v) > 0 ? `${v}` : "")}
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  fill: isDark ? "#c9d1d9" : "#0f172a",
                  fontFamily: "inherit",
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className="rounded-lg border-2 border-slate-900 bg-emerald-50 px-3
            py-2 shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#030712]
            dark:bg-emerald-900/30 dark:shadow-[2px_2px_0px_0px_#030712]"
        >
          <p
            className="text-[9px] font-black uppercase tracking-wide
              text-slate-500 dark:text-muted-foreground"
          >
            30-day total
          </p>
          <p
            className="mt-0.5 text-sm font-black tabular-nums text-slate-600
              dark:text-white"
          >
            {formatCurrency(totalForecast)}
          </p>
        </div>
        <div
          className="rounded-lg border-2 border-slate-900 bg-cyan-50 px-3 py-2
            shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#030712]
            dark:bg-cyan-900/30 dark:shadow-[2px_2px_0px_0px_#030712]"
        >
          <p
            className="text-[9px] font-black uppercase tracking-wide
              text-slate-500 dark:text-muted-foreground"
          >
            peak week
          </p>
          <p
            className="mt-0.5 text-sm font-black tabular-nums text-slate-600
              dark:text-white"
          >
            {peakWeek?.label ?? "—"}
          </p>
          <p
            className="text-[9px] font-semibold tabular-nums text-slate-500
              dark:text-muted-foreground"
          >
            {formatCurrency(peakWeek?.expected ?? 0)}
          </p>
        </div>
        <div
          className="rounded-lg border-2 border-slate-900 bg-amber-50 px-3 py-2
            shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#030712]
            dark:bg-amber-900/30 dark:shadow-[2px_2px_0px_0px_#030712]"
        >
          <p
            className="text-[9px] font-black uppercase tracking-wide
              text-slate-500 dark:text-muted-foreground"
          >
            schedules
          </p>
          <p
            className="mt-0.5 text-sm font-black tabular-nums text-slate-600
              dark:text-white"
          >
            {totalSchedules}
          </p>
          <p
            className="text-[9px] font-semibold text-slate-500
              dark:text-muted-foreground"
          >
            across {activeWeeks} week
            {activeWeeks !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
