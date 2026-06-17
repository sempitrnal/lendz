"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

function fmtMoney(v: number) {
  return `PHP ${Math.round(v).toLocaleString()}`;
}

type Props = {
  name: string;
  color: string | null;
  borrowerCount: number;
  borrowersWithAccountsCount: number;
  moneyToCollect: number;
  nextCollectionDate: string | null;
  nextCollectionTotal: number;
  overdueCount: number;
  overdueTotal: number;
};

export default function CategoryDetailStrip({
  name,
  color,
  borrowerCount,
  borrowersWithAccountsCount,
  moneyToCollect,
  nextCollectionDate,
  nextCollectionTotal,
  overdueCount,
  overdueTotal,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="sticky top-10 sm:top-16 z-30 -mx-4 bg-white/95 backdrop-blur
        relative dark:bg-background/95"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b
          border-slate-200 px-4 py-2 dark:border-border/50"
      >
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full border
                border-slate-900 dark:border-border"
              style={{ backgroundColor: color ?? "#cbd5e1" }}
            />
            <p
              className="truncate text-sm font-black uppercase tracking-wide
                text-slate-600 dark:text-foreground"
            >
              {name}
            </p>
          </div>
          <div
            className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]
              text-slate-500 dark:text-muted-foreground"
          >
            <span>
              <strong className="text-slate-700 dark:text-foreground">
                {borrowerCount}
              </strong>{" "}
              borrowers
            </span>
            <span>
              <strong className="text-slate-700 dark:text-foreground">
                {borrowersWithAccountsCount}
              </strong>{" "}
              with accounts
            </span>
            {nextCollectionDate && (
              <span>
                Next:{" "}
                <strong className="text-slate-700 dark:text-foreground">
                  {new Date(nextCollectionDate).toLocaleDateString()}
                </strong>
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`ml-2 size-4 shrink-0 text-slate-500
            dark:text-muted-foreground transition-transform duration-200
            ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expandable summary grid */}
      <div
        className={`absolute left-0 right-0 top-full z-30 grid overflow-hidden
          bg-white/95 backdrop-blur shadow-[0_4px_0_0_#0f172a]
          dark:bg-background/95 dark:shadow-[0_4px_0_0_#0f172a]
          transition-[grid-template-rows] duration-300 ease-in-out
          ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3 pt-1">
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2
                text-[11px]"
            >
              {[
                {
                  label: "Borrowers",
                  value: borrowerCount,
                  bg: "bg-sky-100 dark:bg-sky-900/30",
                },
                {
                  label: "With accounts",
                  value: borrowersWithAccountsCount,
                  bg: "bg-emerald-100 dark:bg-emerald-900/30",
                },
                {
                  label: "To collect",
                  value: fmtMoney(moneyToCollect),
                  bg: "bg-amber-100 dark:bg-amber-900/30",
                  isText: true,
                },
                {
                  label: "Next collection",
                  value: nextCollectionDate
                    ? `${new Date(nextCollectionDate).toLocaleDateString()} — ${fmtMoney(nextCollectionTotal)}`
                    : "none",
                  bg: "bg-violet-100 dark:bg-violet-900/30",
                  isText: true,
                },
                ...(overdueCount > 0
                  ? [
                      {
                        label: "Overdue",
                        value: `${overdueCount} — ${fmtMoney(overdueTotal)}`,
                        bg: "bg-rose-100 dark:bg-rose-900/30",
                        isText: true,
                      } as const,
                    ]
                  : []),
              ].map(({ label, value, bg, isText }, i) => (
                <div
                  key={label}
                  className={`border-2 border-slate-900 dark:border-border ${bg}
                  px-2 py-1.5 shadow-[2px_2px_0px_0px_#0f172a] transition-all
                  duration-200 ${
                    open
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1 opacity-0"
                  }`}
                  style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
                >
                  <p
                    className="font-black uppercase tracking-wide text-slate-500
                      dark:text-muted-foreground"
                  >
                    {label}
                  </p>
                  <p
                    className="mt-0.5 font-black tabular-nums text-slate-600
                      dark:text-foreground"
                  >
                    {isText
                      ? value
                      : typeof value === "number"
                        ? value.toLocaleString()
                        : value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
