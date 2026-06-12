"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTheme } from "next-themes";

export type OverdueAgingBucket = {
  label: string;
  rangeLabel: string;
  count: number;
  amount: number;
};

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}K`;
  return `₱${v.toLocaleString()}`;
}

const BUCKET_COLORS = ["#fde68a", "#fca5a5", "#f87171", "#dc2626"];
const BUCKET_COLORS_DARK = ["#854d0e", "#7f1d1d", "#991b1b", "#450a0a"];

function NeoBrutalBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#000" } = props;
  if (width <= 0 || height <= 0) return null;
  const shadow = 2;
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
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const amount = payload.find((p) => p.dataKey === "amount")?.value ?? 0;
  const count = payload[0]?.payload?.count ?? 0;
  return (
    <div
      style={{
        border: "2px solid #0f172a",
        boxShadow: "4px 4px 0px 0px #0f172a",
        backgroundColor: "#fff",
        padding: "10px 14px",
        fontFamily: "inherit",
        minWidth: 160,
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
        {label}
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
        <span style={{ color: "#475569" }}>Amount</span>
        <span style={{ color: "#0f172a" }}>₱{amount.toLocaleString()}</span>
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

export default function OverdueAgingChart({
  data,
}: {
  data: OverdueAgingBucket[];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const axisStroke = isDark ? "#30363d" : "#0f172a";
  const tickFill = isDark ? "#8b949e" : "#64748b";
  const labelFill = isDark ? "#c9d1d9" : "#0f172a";

  const hasData = data.some((b) => b.count > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-[10px] font-black uppercase tracking-widest
            text-slate-500 dark:text-muted-foreground"
        >
          overdue aging
        </p>
        <p
          className="text-[10px] font-semibold text-slate-400
            dark:text-muted-foreground"
        >
          days past due
        </p>
      </div>

      {!hasData ? (
        <div
          className="flex h-32 items-center justify-center rounded border-2
            border-dashed border-slate-900 bg-emerald-50 text-sm font-black
            uppercase text-emerald-700 dark:border-border dark:bg-[#0f2417]
            dark:text-[#56d364]"
        >
          no overdue accounts
        </div>
      ) : (
        <>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barCategoryGap="28%"
              >
                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 11,
                    fontWeight: 900,
                    fill: labelFill,
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
                    fill: tickFill,
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
                <Bar dataKey="amount" maxBarSize={48} shape={<NeoBrutalBar />}>
                  {data.map((entry, i) => (
                    <Cell
                      key={entry.label}
                      fill={isDark ? BUCKET_COLORS_DARK[i] : BUCKET_COLORS[i]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Count + amount summary row */}
          <div className="grid grid-cols-4 gap-1.5">
            {data.map((b, i) => (
              <div
                key={b.label}
                className="rounded-lg border-2 border-slate-900 px-2 py-2
                  text-center shadow-[2px_2px_0px_0px_#0f172a]
                  dark:border-[#030712] dark:shadow-[2px_2px_0px_0px_#030712]"
                style={{
                  backgroundColor: isDark ? undefined : BUCKET_COLORS[i] + "80",
                }}
              >
                <p
                  className="text-[9px] font-black uppercase tracking-wide
                    text-slate-500 dark:text-muted-foreground"
                >
                  {b.rangeLabel}
                </p>
                <p
                  className="mt-0.5 text-base font-black tabular-nums
                    text-slate-900 dark:text-white"
                >
                  {b.count}
                </p>
                <p
                  className="text-[9px] font-semibold tabular-nums
                    text-slate-500 dark:text-muted-foreground"
                >
                  {formatCurrency(b.amount)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
