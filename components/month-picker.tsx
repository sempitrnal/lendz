"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function MonthPicker({
  currentMonth,
  variant = "default",
}: {
  currentMonth: string;
  /** "card": round arrows and a short lowercase month, as on the dashboard's cards. */
  variant?: "default" | "card";
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentMonth);

  const navigate = (newValue: string) => {
    setValue(newValue);
    const url = new URL(window.location.href);
    url.searchParams.set("month", newValue);
    router.push(url.pathname + url.search, { scroll: false });
  };

  const prevMonth = () => {
    const [y, m] = value.split("-").map(Number);
    const date = new Date(y, m - 2, 1);
    const yy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    navigate(`${yy}-${mm}`);
  };

  const nextMonth = () => {
    const [y, m] = value.split("-").map(Number);
    const date = new Date(y, m, 1);
    const yy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    navigate(`${yy}-${mm}`);
  };

  const label = new Date(`${value}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (variant === "card") {
    const short = new Date(`${value}-01`)
      .toLocaleDateString("en-US", { month: "short", year: "numeric" })
      .toLowerCase();
    const arrow =
      "flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted";
    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={prevMonth}
          className={arrow}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <label className="relative cursor-pointer">
          <span
            className="block min-w-[4.5rem] text-center text-xs font-bold
              text-card-foreground/80"
          >
            {short}
          </span>
          <input
            type="month"
            aria-label="Month"
            value={value}
            onChange={(e) => e.target.value && navigate(e.target.value)}
            className="absolute inset-0 opacity-0"
          />
        </label>
        <button
          type="button"
          onClick={nextMonth}
          className={arrow}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={prevMonth}
        className="inline-flex items-center justify-center rounded-md p-1
          text-slate-400 transition hover:bg-slate-100 hover:text-slate-600
          dark:hover:bg-white/10 dark:hover:text-foreground"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </button>

      <label className="relative cursor-pointer">
        <span
          className="dark:text-muted-foreground inline-block text-xs
            font-semibold tracking-wider text-slate-600 uppercase"
        >
          {label}
        </span>
        <input
          type="month"
          value={value}
          onChange={(e) => navigate(e.target.value)}
          className="absolute inset-0 opacity-0"
        />
      </label>

      <button
        type="button"
        onClick={nextMonth}
        className="inline-flex items-center justify-center rounded-md p-1
          text-slate-400 transition hover:bg-slate-100 hover:text-slate-600
          dark:hover:bg-white/10 dark:hover:text-foreground"
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
