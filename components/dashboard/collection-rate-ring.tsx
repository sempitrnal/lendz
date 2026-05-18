"use client";

import { PieChart, Pie, Cell, Label, ResponsiveContainer } from "recharts";

export type RingData = {
  collected: number;
  expectedSoFar: number;
  profit: number;
  expectedProfit: number;
  expectedProfitSoFar: number;
  isComplete: boolean;
  monthLabel: string;
};

function ringColor(pct: number) {
  if (pct >= 80) return "#6ee7b7";
  if (pct >= 50) return "#a5b4fc";
  return "#fca5a5";
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}K`;
  return `₱${v.toLocaleString()}`;
}

export default function CollectionRateRing({ data }: { data: RingData }) {
  const { collected, expectedSoFar, profit, expectedProfit, expectedProfitSoFar, isComplete, monthLabel } = data;

  const pct =
    expectedSoFar > 0
      ? Math.min(100, Math.round((collected / expectedSoFar) * 100))
      : 0;

  const profitPct =
    expectedProfit > 0
      ? Math.min(100, Math.round((profit / expectedProfit) * 100))
      : 0;

  const fill = ringColor(pct);
  const chartData = [{ value: pct }, { value: Math.max(0, 100 - pct) }];

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          collection rate
        </p>
        <span className="rounded border-2 border-slate-900 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-[2px_2px_0px_0px_#0f172a]">
          {isComplete ? monthLabel : `${monthLabel} so far`}
        </span>
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="72%"
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive
            >
              <Cell fill={fill} stroke="#0f172a" strokeWidth={2} />
              <Cell fill="#e2e8f0" stroke="#0f172a" strokeWidth={2} />
              <Label
                content={({ viewBox }) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { cx, cy } = viewBox as any;
                  return (
                    <g>
                      <text
                        x={cx}
                        y={cy - 6}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize={20}
                        fontWeight={900}
                        fontFamily="inherit"
                      >
                        {pct}%
                      </text>
                      <text
                        x={cx}
                        y={cy + 14}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize={9}
                        fontWeight={700}
                        fontFamily="inherit"
                        letterSpacing="0.1em"
                      >
                        COLLECTED
                      </text>
                    </g>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between rounded border-2 border-slate-900 bg-slate-50 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#0f172a]">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Collected</span>
          <span className="text-xs font-black tabular-nums text-slate-900">{formatCurrency(collected)}</span>
        </div>
        <div className="flex items-center justify-between rounded border-2 border-slate-900 bg-slate-50 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#0f172a]">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Expected so far</span>
          <span className="text-xs font-black tabular-nums text-slate-900">{formatCurrency(expectedSoFar)}</span>
        </div>
        {isComplete && expectedProfit > 0 && (
          <div className="flex items-center justify-between rounded border-2 border-slate-900 bg-amber-50 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#0f172a]">
            <span className="text-[10px] font-black uppercase tracking-wide text-amber-700">Interest rate</span>
            <span className="text-xs font-black tabular-nums text-amber-800">{profitPct}%</span>
          </div>
        )}
        {!isComplete && expectedProfitSoFar > 0 && (
          <div className="flex items-center justify-between rounded border-2 border-slate-900 bg-amber-50 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#0f172a]">
            <span className="text-[10px] font-black uppercase tracking-wide text-amber-700">Exp. interest so far</span>
            <span className="text-xs font-black tabular-nums text-amber-800">{formatCurrency(expectedProfitSoFar)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
