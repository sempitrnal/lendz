"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { isDarkColor } from "@/lib/utils";

function useCountUp(target: number, active: boolean, duration = 500) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, target, duration]);
  return display;
}

function AnimatedMoney({
  value,
  active,
  delay = 0,
}: {
  value: number;
  active: boolean;
  delay?: number;
}) {
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (!active || fired) return;
    const t = setTimeout(() => setFired(true), delay);
    return () => clearTimeout(t);
  }, [active, delay, fired]);
  const n = useCountUp(value, fired);
  return <span>₱{n.toLocaleString()}</span>;
}

type Props = {
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

function fmt(v: number) {
  return `₱${Math.round(v).toLocaleString()}`;
}

export default function StickyAccountStrip({
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
        className="bg-[#fefff3] dark:bg-background sticky top-16 mx-auto right-0
          left-0 z-40 sm:top-16 md:top-16 md:left-(--sidebar-width)"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="dark:border-border flex w-full items-center justify-between
            border-b border-slate-200 px-4 py-2"
        >
          <div className="min-w-0 text-left">
            <div className="flex flex-col items-start gap-0.5 mb-2">
              <p
                className="dark:text-foreground truncate text-sm font-black
                  tracking-wide text-slate-900 uppercase"
              >
                {borrowerName}
              </p>
              {categoryLabel && (
                <span
                  className={`rounded border border-slate-900/30 px-1.5 py-0.5
                  text-[9px] font-black
                  ${isDarkColor(categoryColor ?? "#cbd5e1") ? "text-white" : "text-slate-900"}`}
                  style={{ backgroundColor: categoryColor ?? "#cbd5e1" }}
                >
                  {categoryLabel}
                </span>
              )}
            </div>

            <div
              className="dark:text-muted-foreground mt-0.5 flex flex-wrap
                gap-x-3 gap-y-0.5 text-[11px] text-slate-500"
            >
              <span>
                Released{" "}
                <strong className="dark:text-foreground text-slate-700">
                  {releaseDate}
                </strong>
              </span>
              <span>
                Interest{" "}
                <strong className="dark:text-foreground text-slate-700">
                  {interest}%
                </strong>
              </span>
              <span>
                Term{" "}
                <strong className="dark:text-foreground text-slate-700">
                  {isManual ? "manual" : `${termMonths} ${paymentFrequency}`}
                </strong>
              </span>
            </div>
          </div>
          <ChevronDown
            className={`dark:text-muted-foreground ml-2 size-4 shrink-0
              text-slate-500 transition-transform duration-200
              ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown overlay */}
        <div
          className={`bg-background/95 dark:bg-background/95 absolute top-full
            right-0 left-0 z-30 overflow-hidden border-x-2 border-b-2
            border-slate-900 shadow-[0_4px_0px_0px_#0f172a] backdrop-blur
            transition-all duration-300 ease-out dark:border-[#020617]
            dark:shadow-[0_4px_0px_0px_#020617]
            ${open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pb-3">
            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
              {[
                {
                  label: "Principal",
                  value: principal,
                  bg: "bg-sky-100 dark:bg-sky-900/30",
                },
                {
                  label: "Remaining",
                  value: remaining,
                  bg: "bg-rose-100 dark:bg-rose-900/30",
                },
                {
                  label: "Collected",
                  value: collected,
                  bg: "bg-emerald-100 dark:bg-emerald-900/30",
                },
                {
                  label: "Profit",
                  value: Math.max(0, profit),
                  bg: "bg-amber-100 dark:bg-amber-900/30",
                },
              ].map(({ label, value, bg }) => (
                <div
                  key={label}
                  className={`border-2 border-slate-900 ${bg} px-2 py-1.5
                  shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617]`}
                >
                  <p
                    className="text-[#414d7c] font-bold text md:text-base
                      font-mono dark:text-[#a98080] uppercase"
                  >
                    {label}
                  </p>
                  <p
                    className="dark:text-[#c2c2c2] mt-0.5 text-xl md:text-3xl
                      font-bold text-[#593b5e] tabular-nums"
                  >
                    ₱{Math.round(value).toLocaleString()}
                  </p>
                </div>
              ))}
              <div
                className="col-span-2 border-2 border-slate-900 bg-violet-100
                  px-2 py-1.5 shadow-[2px_2px_0px_0px_#0f172a]
                  dark:border-[#020617] dark:bg-violet-900/30"
              >
                <p
                  className="text-[#414d7c] font-bold text md:text-base
                    font-mono dark:text-[#a98080] uppercase"
                >
                  Profit / payroll
                </p>
                <p
                  className="dark:text-[#c2c2c2] mt-0.5 text-xl md:text-3xl
                    font-bold text-[#593b5e] tabular-nums"
                >
                  ₱{Math.round(profitPerPayroll).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-2 flex-1 overflow-hidden rounded-sm border-2
                  border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]
                  dark:border-[#020617] dark:bg-slate-900"
              >
                <div
                  className="h-full bg-emerald-400 transition-[width]
                    duration-500 ease-out dark:bg-emerald-500"
                  style={{ width: open ? `${progressPct}%` : "0%" }}
                />
              </div>
              <span
                className="dark:text-[#c2c2c2] mt-0.5 text-xl md:text-3xl
                  font-bold text-[#593b5e] tabular-nums"
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
