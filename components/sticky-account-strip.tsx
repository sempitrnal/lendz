"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { isDarkColor } from "@/lib/utils";
import Link from "next/link";

type Props = {
  borrowerId: string;
  borrowerName: string;
  categoryLabel?: string;
  categoryColor?: string | null;
  releaseDate: string;
  interest: number;
  termMonths: number;
  paymentFrequency: string;
  isManual?: boolean;
  principal: number;
  remaining: number;
  collected: number;
  profit: number;
  profitPerPayroll: number;
  progressPct: number;
};

export default function StickyAccountStrip({
  borrowerId,
  borrowerName,
  categoryLabel,
  categoryColor,
  releaseDate,
  interest,
  termMonths,
  paymentFrequency,
  isManual = false,
  principal,
  remaining,
  collected,
  profit,
  profitPerPayroll,
  progressPct,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="sticky top-16 z-40 border-b border-slate-300/60
          bg-background/80 backdrop-blur-md dark:border-slate-700/60 sm:top-16
          md:top-16"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3
            transition-colors duration-200 hover:bg-slate-50/50
            dark:hover:bg-slate-800/30"
        >
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              <Link
                onClick={(e) => {
                  e.stopPropagation();
                }}
                href={`/borrowers/${borrowerId}`}
                className="truncate text-lg font-black tracking-tight
                  text-slate-700 dark:text-foreground"
              >
                {borrowerName}
              </Link>
            </div>
            {categoryLabel && (
              <span
                className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold
                ${isDarkColor(categoryColor ?? "#cbd5e1") ? "text-white" : "text-slate-700"}`}
                style={{
                  backgroundColor: categoryColor
                    ? `${categoryColor}`
                    : "#cbd5e120",
                  border: `1px solid ${categoryColor ? `${categoryColor}40` : "#cbd5e140"}`,
                }}
              >
                {categoryLabel}
              </span>
            )}
            <div
              className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]
                text-slate-400 dark:text-muted-foreground"
            >
              <span>
                Released{" "}
                <strong
                  className="font-semibold text-slate-600
                    dark:text-foreground/80"
                >
                  {releaseDate}
                </strong>
              </span>
              <span>
                Interest{" "}
                <strong
                  className="font-semibold text-slate-600
                    dark:text-foreground/80"
                >
                  {interest}%
                </strong>
              </span>
              <span>
                Term{" "}
                <strong
                  className="font-semibold text-slate-600
                    dark:text-foreground/80"
                >
                  {isManual ? "manual" : `${termMonths} ${paymentFrequency}`}
                </strong>
              </span>
            </div>
          </div>
          <ChevronDown
            className={`ml-2 size-4 shrink-0 text-slate-400 transition-transform
              duration-200 dark:text-muted-foreground
              ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown overlay */}
        <div
          className={`absolute top-full right-0 left-0 z-30 overflow-hidden
            border-x border-b border-slate-300/60 bg-background/95
            backdrop-blur-md transition-all duration-300 ease-out
            dark:border-slate-700/60
            ${open ? "max-h-[440px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-3">
              {[
                {
                  label: "Principal",
                  value: principal,
                  tint: "bg-sky-50 dark:bg-sky-900/20",
                  text: "text-sky-700 dark:text-sky-300",
                },
                {
                  label: "Remaining",
                  value: remaining,
                  tint: "bg-rose-50 dark:bg-rose-900/20",
                  text: "text-rose-700 dark:text-rose-300",
                },
                {
                  label: "Collected",
                  value: collected,
                  tint: "bg-emerald-50 dark:bg-emerald-900/20",
                  text: "text-emerald-700 dark:text-emerald-300",
                },
                {
                  label: "Profit",
                  value: Math.max(0, profit),
                  tint: "bg-amber-50 dark:bg-amber-900/20",
                  text: "text-amber-700 dark:text-amber-300",
                },
              ].map(({ label, value, tint, text }) => (
                <div
                  key={label}
                  className={`rounded-xl border border-slate-300/60 ${tint} px-3
                  py-2 dark:border-slate-700/60`}
                >
                  <p
                    className={`text-[10px] font-semibold uppercase
                    tracking-wide ${text}`}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-0.5 text-lg font-bold tabular-nums
                      text-slate-700 dark:text-foreground"
                  >
                    ₱{Math.round(value).toLocaleString()}
                  </p>
                </div>
              ))}
              <div
                className="col-span-2 rounded-xl border border-slate-300/60
                  bg-violet-50 px-3 py-2 dark:border-slate-700/60
                  dark:bg-violet-900/20"
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide
                    text-violet-700 dark:text-violet-300"
                >
                  Profit / payroll
                </p>
                <p
                  className="mt-0.5 text-lg font-bold tabular-nums
                    text-slate-700 dark:text-foreground"
                >
                  ₱{Math.round(profitPerPayroll).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full border
                  border-slate-300/60 bg-slate-100 dark:border-slate-700/60
                  dark:bg-slate-800"
              >
                <div
                  className="h-full rounded-full bg-emerald-400
                    transition-[width] duration-500 ease-out
                    dark:bg-emerald-500"
                  style={{ width: open ? `${progressPct}%` : "0%" }}
                />
              </div>
              <span
                className="text-sm font-bold tabular-nums text-slate-600
                  dark:text-foreground"
              >
                {progressPct}%
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Spacer so content doesn't hide under fixed strip */}
    </>
  );
}
