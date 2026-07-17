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
      className="sticky top-10 sm:top-16 z-30 -mx-4 bg-background/80
        backdrop-blur-md relative dark:bg-background/80"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b
          border-slate-200/60 px-4 py-3 transition-colors hover:bg-slate-50/50
          dark:border-slate-700/60 dark:hover:bg-slate-800/30"
      >
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${color ?? "#cbd5e1"}20`,
              }}
            >
              <span
                className="block size-3 rounded-full"
                style={{ backgroundColor: color ?? "#cbd5e1" }}
              />
            </span>
            <p
              className="truncate text-base font-bold tracking-tight
                text-slate-700 dark:text-foreground"
            >
              {name}
            </p>
          </div>
          <div
            className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]
              text-slate-400 dark:text-muted-foreground"
          >
            <span>
              <strong className="font-semibold text-slate-600
                dark:text-foreground/80">
                {borrowerCount}
              </strong>{" "}
              borrowers
            </span>
            <span>
              <strong className="font-semibold text-slate-600
                dark:text-foreground/80">
                {borrowersWithAccountsCount}
              </strong>{" "}
              with accounts
            </span>
            {nextCollectionDate && (
              <span>
                Next:{" "}
                <strong
                  className="font-semibold text-slate-600
                    dark:text-foreground/80"
                >
                  {new Date(nextCollectionDate).toLocaleDateString()}
                </strong>
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`ml-2 size-4 shrink-0 text-slate-400 transition-transform
            duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expandable summary grid */}
      <div
        className={`absolute left-0 right-0 top-full z-30 grid overflow-hidden
          bg-background/95 backdrop-blur-md border-b border-slate-200/60
          dark:border-slate-700/60 transition-[grid-template-rows] duration-300
          ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-2">
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
            >
              {[
                {
                  label: "Borrowers",
                  value: borrowerCount,
                  tint: "bg-sky-50 dark:bg-sky-900/20",
                  text: "text-sky-700 dark:text-sky-300",
                },
                {
                  label: "With accounts",
                  value: borrowersWithAccountsCount,
                  tint: "bg-emerald-50 dark:bg-emerald-900/20",
                  text: "text-emerald-700 dark:text-emerald-300",
                },
                {
                  label: "To collect",
                  value: fmtMoney(moneyToCollect),
                  tint: "bg-amber-50 dark:bg-amber-900/20",
                  text: "text-amber-700 dark:text-amber-300",
                  isText: true,
                },
                {
                  label: "Next collection",
                  value: nextCollectionDate
                    ? `${new Date(nextCollectionDate).toLocaleDateString()} — ${fmtMoney(nextCollectionTotal)}`
                    : "none",
                  tint: "bg-violet-50 dark:bg-violet-900/20",
                  text: "text-violet-700 dark:text-violet-300",
                  isText: true,
                },
                ...(overdueCount > 0
                  ? [
                      {
                        label: "Overdue",
                        value: `${overdueCount} — ${fmtMoney(overdueTotal)}`,
                        tint: "bg-rose-50 dark:bg-rose-900/20",
                        text: "text-rose-700 dark:text-rose-300",
                        isText: true,
                      } as const,
                    ]
                  : []),
              ].map(({ label, value, tint, text, isText }, i) => (
                <div
                  key={label}
                  className={`rounded-xl border border-slate-200/60 ${tint} px-3
                  py-2 transition-all duration-200 dark:border-slate-700/60
                  ${open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
                  style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
                >
                  <p
                    className={`text-[10px] font-semibold uppercase
                    tracking-wide ${text}`}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-0.5 text-sm font-bold tabular-nums
                      text-slate-700 dark:text-foreground"
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
