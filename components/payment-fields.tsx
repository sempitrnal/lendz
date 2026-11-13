"use client";

import { type ChangeEvent } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  relativeDayLabel,
  shiftDateValue,
  todayDateValue,
} from "@/lib/checklist/dates";

/**
 * The two inputs every payment form asks for, in one look: how much was paid
 * and on what day. Each has one-tap shortcuts for the usual answers, so the
 * common case (paid in full, today) needs no typing.
 */

const labelClasses =
  "text-[11px] font-black tracking-wide text-slate-600 uppercase dark:text-slate-300";

const chip = (active: boolean) =>
  cn(
    `rounded-full border px-3 py-1.5 text-xs font-bold transition-colors
    active:scale-95`,
    active
      ? `border-emerald-500/50 bg-emerald-500/10 text-emerald-700
        dark:text-emerald-300`
      : `border-slate-200 bg-white text-slate-600 hover:bg-slate-50
        dark:border-border dark:bg-card dark:text-muted-foreground
        dark:hover:bg-muted`,
  );

const field = `h-12 w-full rounded-xl border border-slate-200 bg-white text-base
  font-bold text-slate-800 outline-none transition focus:border-emerald-500
  focus:ring-2 focus:ring-emerald-500/20 dark:border-border dark:bg-card
  dark:text-foreground`;

/** "1,234.5": the digits typed so far, grouped by thousands. */
export function formatAmount(raw: string) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

/** Keeps only digits and the first decimal point. */
export function cleanAmount(value: string) {
  let cleaned = value.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function AmountField({
  id,
  label = "Amount paid",
  value,
  onChange,
  remaining,
  autoFocus,
}: {
  id: string;
  label?: string;
  /** The digits typed, unformatted ("1234.5"). */
  value: string;
  onChange(next: string): void;
  /** What is still owed on the schedule: offers "full" and "half". */
  remaining?: number;
  autoFocus?: boolean;
}) {
  const full =
    remaining && remaining > 0 ? Math.round(remaining * 100) / 100 : 0;
  const half = full ? Math.round((full / 2) * 100) / 100 : 0;
  const is = (n: number) => Number(value) === n;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-4 -translate-y-1/2 text-lg font-black
            text-slate-400"
        >
          ₱
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          required
          autoFocus={autoFocus}
          autoComplete="off"
          value={formatAmount(value)}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(cleanAmount(e.target.value))
          }
          className={cn(field, "pl-9 pr-4 text-xl tabular-nums")}
        />
      </div>
      {full > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange(String(full))}
            className={chip(is(full))}
          >
            full · ₱{money(full)}
          </button>
          {half > 0 && half !== full && (
            <button
              type="button"
              onClick={() => onChange(String(half))}
              className={chip(is(half))}
            >
              half · ₱{money(half)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DateField({
  id,
  name,
  label = "Date paid",
  value,
  onChange,
  dueDate,
}: {
  id: string;
  /** Set when the field sits in a form that reads it by name. */
  name?: string;
  label?: string;
  /** `YYYY-MM-DD`. */
  value: string;
  onChange(next: string): void;
  /** The schedule's due date: offered as a shortcut. */
  dueDate?: string;
}) {
  const today = todayDateValue();
  const yesterday = shiftDateValue(today, -1);
  const shortcuts: [string, string][] = [
    ["today", today],
    ["yesterday", yesterday],
  ];
  if (dueDate && dueDate !== today && dueDate !== yesterday) {
    shortcuts.push(["due date", dueDate.slice(0, 10)]);
  }
  const relative = value ? relativeDayLabel(value, today) : null;
  const pretty = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "pick a date";
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map(([text, date]) => (
          <button
            key={text}
            type="button"
            onClick={() => onChange(date)}
            className={chip(value === date)}
          >
            {text}
          </button>
        ))}
      </div>
      {/* The real date input sits invisibly over the styled box, so a tap
          opens the device's own picker on every browser. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className={cn(
            field,
            "flex items-center gap-2.5 px-4 text-sm focus-within:ring-2",
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate">{pretty}</span>
          {relative && (
            <span
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px]
                font-bold text-muted-foreground"
            >
              {relative}
            </span>
          )}
        </div>
        <input
          id={id}
          name={name}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // Already open, or not supported: the tap did its job.
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
