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

export type OverdueCategoryEntry = {
  name: string;
  color: string | null;
  total: number;
  principal: number;
  profit: number;
};

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}K`;
  return `₱${v.toLocaleString()}`;
}

function StackedBar(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#cbd5e1" } = props;
  if (width <= 0 || height <= 0) return null;
  return (
    <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#0f172a" strokeWidth={1.5} />
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
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const principal = payload.find((p) => p.dataKey === "principal")?.value ?? 0;
  const profit = payload.find((p) => p.dataKey === "profit")?.value ?? 0;
  const total = principal + profit;
  return (
    <div style={{ border: "2px solid #0f172a", boxShadow: "4px 4px 0px 0px #0f172a", backgroundColor: "#fff", padding: "10px 14px", fontFamily: "inherit", minWidth: 170 }}>
      <p style={{ fontWeight: 900, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, color: "#0f172a" }}>
        {label}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, fontWeight: 700, marginBottom: 3 }}>
        <span style={{ color: "#475569" }}>Total overdue</span>
        <span style={{ color: "#0f172a" }}>₱{total.toLocaleString()}</span>
      </div>
      <div style={{ borderTop: "2px solid #0f172a", margin: "6px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, fontWeight: 700, marginBottom: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#475569" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, backgroundColor: "#cbd5e1", border: "1.5px solid #0f172a" }} />
          Principal
        </span>
        <span style={{ color: "#0f172a" }}>₱{principal.toLocaleString()}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, fontWeight: 900 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#92400e" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, backgroundColor: "#fcd34d", border: "1.5px solid #0f172a" }} />
          Interest
        </span>
        <span style={{ color: "#92400e", backgroundColor: "#fef3c7", padding: "0px 5px", border: "1.5px solid #0f172a" }}>₱{profit.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function OverdueByCategoryChart({
  data,
}: {
  data: OverdueCategoryEntry[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded border-2 border-dashed border-slate-900 bg-emerald-50 text-sm font-black uppercase text-emerald-700">
        no overdue accounts
      </div>
    );
  }

  const barHeight = 32;
  const chartHeight = Math.max(120, data.length * (barHeight + 14) + 40);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          overdue by category
        </p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <span className="inline-block size-2.5 border border-slate-900 bg-slate-200" />
            Principal
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
            <span className="inline-block size-2.5 border border-slate-900 bg-amber-300" />
            Interest
          </span>
        </div>
      </div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            <XAxis
              type="number"
              tickFormatter={(v) => formatCurrency(Number(v))}
              tick={{ fontSize: 9, fontWeight: 700, fill: "#64748b", fontFamily: "inherit" }}
              axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={76}
              tick={{ fontSize: 10, fontWeight: 900, fill: "#0f172a", fontFamily: "inherit" }}
              axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(15,23,42,0.04)", stroke: "#0f172a", strokeWidth: 1 }}
              content={<CustomTooltip />}
            />
            <Bar dataKey="principal" stackId="a" maxBarSize={barHeight} shape={<StackedBar />}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color ?? "#cbd5e1"} />
              ))}
            </Bar>
            <Bar dataKey="profit" stackId="a" maxBarSize={barHeight} shape={<StackedBar />}>
              {data.map((entry) => (
                <Cell key={entry.name} fill="#fcd34d" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
