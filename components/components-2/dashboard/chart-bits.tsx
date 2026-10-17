"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatPesoCompact } from "@/lib/dashboard-data";

export const RANGE_OPTIONS = [6, 12] as const;
export type RangeOption = (typeof RANGE_OPTIONS)[number];

export function RangeToggle({
  value,
  onChange,
}: {
  value: RangeOption;
  onChange: (value: RangeOption) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Months shown"
      className="inline-flex rounded-lg border border-border bg-secondary/60
        p-0.5 text-xs font-medium"
    >
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            value === opt
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground hover:text-card-foreground",
          )}
        >
          {opt}M
        </button>
      ))}
    </div>
  );
}

export function TooltipCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-popover px-3 py-2 text-sm
        shadow-md"
    >
      <p className="font-medium text-popover-foreground">{title}</p>
      <div className="mt-1 space-y-0.5 text-muted-foreground">{children}</div>
    </div>
  );
}

export function HeadlineStat({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "up" | "down";
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium lowercase text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-0.5 truncate text-lg font-semibold tracking-tight
          text-card-foreground tabular-nums"
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "truncate text-xs",
            subTone === "up"
              ? "font-medium text-primary"
              : subTone === "down"
                ? "font-medium text-rose-600 dark:text-rose-400"
                : "text-muted-foreground",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };

export function pesoAxisTick(v: unknown) {
  return formatPesoCompact(Number(v)).replace("₱", "");
}

/** Vertical fade for bar fills; reference it as `fill="url(#id)"`. */
export function BarGradient({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={1} />
        <stop offset="100%" stopColor={color} stopOpacity={0.55} />
      </linearGradient>
    </defs>
  );
}

export const chartCursor = { fill: "var(--secondary)", radius: 6 };
