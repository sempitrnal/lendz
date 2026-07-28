"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type MonthlyData = {
  label: string;
  fullLabel: string;
  expected: number;
  expectedSoFar: number;
  collected: number;
  profit: number;
  expectedProfit: number;
  expectedProfitSoFar: number;
  isComplete: boolean;
};

const COLORS = {
  expected: "#e2e8f0",
  expectedSoFar: "#a5b4fc",
  collected: "#6ee7b7",
  profit: "#fcd34d",
};

const LABELS: Record<string, string> = {
  expected: "Full Expected",
  expectedSoFar: "So Far",
  collected: "Collected",
  profit: "Profit",
};

const TOOLTIP_LABELS: Record<string, string> = {
  expected: "to collect this month",
  expectedSoFar: "to collect so far",
  collected: "collected",
  profit: "meme total",
};

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}K`;
  return `₱${value.toLocaleString()}`;
}

function NeoBrutalBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#000" } = props;
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

function CustomTooltip({
  active,
  payload,
  label,
  data,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string | number;
  data: MonthlyData[];
}) {
  if (!active || !payload?.length) return null;
  const entry = data.find((d) => d.label === String(label));
  return (
    <div
      style={{
        border: "2px solid #0f172a",
        boxShadow: "4px 4px 0px 0px #0f172a",
        backgroundColor: "#fff",
        padding: "10px 14px",
        fontFamily: "inherit",
        minWidth: 180,
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
        {entry?.fullLabel ?? label}
      </p>
      {payload
        .filter((item) => item.name !== "profit")
        .map((item) => (
          <div
            key={item.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#475569",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  backgroundColor: item.color,
                  border: "1.5px solid #0f172a",
                  flexShrink: 0,
                }}
              />
              {TOOLTIP_LABELS[item.name] ?? item.name}
            </span>
            <span style={{ color: "#0f172a" }}>
              ₱{Number(item.value).toLocaleString()}
            </span>
          </div>
        ))}
      {entry && (
        <>
          <div
            style={{
              borderTop: "2px solid #0f172a",
              margin: "8px 0",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {/* <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", whiteSpace: "nowrap" }}>profit</span> */}
            <div style={{ flex: 1, height: 1, backgroundColor: "#0f172a" }} />
          </div>
          {(() => {
            const profitItem = payload.find((item) => item.name === "profit");
            return profitItem ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#475569",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      backgroundColor: profitItem.color,
                      border: "1.5px solid #0f172a",
                      flexShrink: 0,
                    }}
                  />
                  {TOOLTIP_LABELS.profit}
                </span>
                <span style={{ color: "#0f172a" }}>
                  ₱{Number(profitItem.value).toLocaleString()}
                </span>
              </div>
            ) : null;
          })()}
          {entry.isComplete ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 12,
                  fontWeight: 900,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    color: "#92400e",
                    textTransform: "lowercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  meme (expected)
                </span>
                <span
                  style={{
                    color: "#92400e",
                    backgroundColor: "#fef3c7",
                    padding: "1px 6px",
                    border: "1.5px solid #0f172a",
                  }}
                >
                  ₱{entry.expectedProfit.toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                <span
                  style={{
                    color: "#991b1b",
                    textTransform: "lowercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  wa nakuha
                </span>
                <span
                  style={{
                    color: "#991b1b",
                    backgroundColor: "#fee2e2",
                    padding: "1px 6px",
                    border: "1.5px solid #0f172a",
                  }}
                >
                  ₱
                  {Math.max(
                    0,
                    entry.expectedProfit - entry.profit,
                  ).toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 12,
                  fontWeight: 900,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    color: "#92400e",
                    textTransform: "lowercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  meme (so far)
                </span>
                <span
                  style={{
                    color: "#92400e",
                    backgroundColor: "#fef3c7",
                    padding: "1px 6px",
                    border: "1.5px solid #0f172a",
                  }}
                >
                  ₱{entry.expectedProfitSoFar.toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                <span
                  style={{
                    color: "#991b1b",
                    textTransform: "lowercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  wa nakuha so far
                </span>
                <span
                  style={{
                    color: "#991b1b",
                    backgroundColor: "#fee2e2",
                    padding: "1px 6px",
                    border: "1.5px solid #0f172a",
                  }}
                >
                  ₱
                  {Math.max(
                    0,
                    entry.expectedProfitSoFar - entry.profit,
                  ).toLocaleString()}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

type SeriesKey = "expected" | "expectedSoFar" | "collected" | "profit";
const ALL_SERIES: SeriesKey[] = [
  "expected",
  "expectedSoFar",
  "collected",
  "profit",
];

export default function MonthlyCollectionsChart({
  data,
}: {
  data: MonthlyData[];
}) {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    expected: true,
    expectedSoFar: true,
    collected: true,
    profit: true,
  });

  function toggle(key: SeriesKey) {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const anyOn = ALL_SERIES.some((k) => next[k]);
      return anyOn ? next : prev;
    });
  }

  if (data.length === 0) {
    return (
      <div
        className="flex h-48 items-center justify-center rounded-lg border-2
          border-dashed border-slate-900 bg-slate-50 text-sm font-bold
          text-slate-500 uppercase"
      >
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Interactive legend */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          {(["expected", "expectedSoFar", "collected"] as SeriesKey[]).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={`inline-flex cursor-pointer items-center gap-1.5
                rounded border-2 border-slate-900 px-2 py-0.5 text-[10px]
                font-black tracking-wide uppercase transition-opacity ${
                  visible[key]
                    ? "bg-white text-slate-600 shadow-[2px_2px_0px_0px_#0f172a]"
                    : "bg-slate-100 text-slate-400 opacity-50 shadow-none"
                }`}
              >
                <span
                  className="inline-block size-2.5 shrink-0 border
                    border-slate-900"
                  style={{
                    backgroundColor: visible[key] ? COLORS[key] : "#e2e8f0",
                  }}
                />
                {LABELS[key]}
              </button>
            ),
          )}
          <span
            className="ml-auto self-center text-[10px] font-semibold
              text-slate-400"
          >
            tap to toggle
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-black tracking-widest text-slate-400
              uppercase"
          >
            profit
          </span>
          <div className="h-px flex-1 bg-slate-200" />
          <button
            type="button"
            onClick={() => toggle("profit")}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded
              border-2 border-slate-900 px-2 py-0.5 text-[10px] font-black
              tracking-wide uppercase transition-opacity ${
                visible.profit
                  ? "bg-white text-slate-800 shadow-[2px_2px_0px_0px_#0f172a]"
                  : "bg-slate-100 text-slate-400 opacity-50 shadow-none"
              }`}
          >
            <span
              className="inline-block size-2.5 shrink-0 border border-slate-900"
              style={{
                backgroundColor: visible.profit ? COLORS.profit : "#e2e8f0",
              }}
            />
            {LABELS.profit}
          </button>
        </div>
      </div>

      {/* Horizontal scroll so bars never squish on mobile */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="h-64 sm:h-72" style={{ minWidth: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
              barCategoryGap="22%"
              barGap={3}
            >
              <CartesianGrid
                vertical={false}
                stroke="#0f172a"
                strokeWidth={1}
                strokeOpacity={0.08}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 11,
                  fontWeight: 900,
                  fill: "#0f172a",
                  fontFamily: "inherit",
                }}
                axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(Number(v))}
                tick={{
                  fontSize: 10,
                  fontWeight: 700,
                  fill: "#475569",
                  fontFamily: "inherit",
                }}
                axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                tickLine={false}
              />
              <Tooltip
                cursor={{
                  fill: "rgba(15,23,42,0.05)",
                  stroke: "#0f172a",
                  strokeWidth: 2,
                }}
                content={(props) => <CustomTooltip {...props} data={data} />}
              />
              {ALL_SERIES.map((key) =>
                visible[key] ? (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={COLORS[key]}
                    maxBarSize={20}
                    shape={<NeoBrutalBar />}
                  />
                ) : null,
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
