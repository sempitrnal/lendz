"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const shiftDay = (date: string, by: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
};

const label = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
};

/**
 * Previous and next day arrows around the day, with the date picker behind
 * the label. Moving puts the day in the page's `?date=`.
 */
export default function DayPicker({
  date,
  today,
}: {
  /** The day shown, "2026-11-12". */
  date: string;
  /** Today's date, so the next arrow stops there. */
  today: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(date);

  const go = (next: string) => {
    if (!next) return;
    setValue(next);
    router.push(`?date=${next}`, { scroll: false });
  };

  const arrow =
    "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-30";

  return (
    <div
      className="flex items-center justify-between rounded-2xl bg-card p-1
        shadow-sm ring-1 ring-black/5 dark:ring-white/10"
    >
      <button
        type="button"
        onClick={() => go(shiftDay(value, -1))}
        className={arrow}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-5" />
      </button>
      <label className="relative min-w-0 flex-1 cursor-pointer overflow-hidden">
        <span
          className="block truncate text-center text-sm font-bold
            text-card-foreground/80"
        >
          {label(value)}
          {value === today ? (
            <span
              className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5
                text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15
                dark:text-emerald-300"
            >
              today
            </span>
          ) : null}
        </span>
        <input
          type="date"
          aria-label="Day"
          value={value}
          max={today}
          onChange={(e) => go(e.target.value)}
          className="absolute inset-0 h-full w-full min-w-0 appearance-none
            opacity-0"
        />
      </label>
      <button
        type="button"
        onClick={() => go(shiftDay(value, 1))}
        disabled={value >= today}
        className={arrow}
        aria-label="Next day"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
