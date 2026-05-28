"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

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

function AnimatedMoney({ value, active, delay = 0 }: { value: number; active: boolean; delay?: number }) {
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
    <div className="sticky top-10 z-30 -mx-4 bg-white/95 backdrop-blur sm:hidden relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-2"
      >
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-black uppercase tracking-wide text-slate-900">
            {borrowerName}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span>Released <strong className="text-slate-700">{releaseDate}</strong></span>
            <span>Interest <strong className="text-slate-700">{interest}%</strong></span>
            <span>Term <strong className="text-slate-700">{isManual ? "manual" : `${termMonths} ${paymentFrequency}`}</strong></span>
          </div>
        </div>
        <ChevronDown
          className={`ml-2 size-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Absolute overlay — doesn't push page content */}
      <div className={`absolute left-0 right-0 top-full z-30 grid overflow-hidden bg-white/95 backdrop-blur shadow-[0_4px_0_0_#0f172a] transition-[grid-template-rows] duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-3">
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {[
                { label: "Principal", value: principal, bg: "bg-sky-100" },
                { label: "Remaining", value: remaining, bg: "bg-rose-100" },
                { label: "Collected", value: collected, bg: "bg-emerald-100" },
                { label: "Profit", value: Math.max(0, profit), bg: "bg-amber-100" },
              ].map(({ label, value, bg }, i) => (
                <div
                  key={label}
                  className={`border-2 border-slate-900 ${bg} px-2 py-1.5 shadow-[2px_2px_0px_0px_#0f172a] transition-all duration-200 ${
                    open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                  }`}
                  style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
                >
                  <p className="font-black uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-0.5 font-black tabular-nums text-slate-900">
                    <AnimatedMoney value={value} active={open} delay={i * 40} />
                  </p>
                </div>
              ))}
              <div
                className={`col-span-2 border-2 border-slate-900 bg-violet-100 px-2 py-1.5 shadow-[2px_2px_0px_0px_#0f172a] transition-all duration-200 ${
                  open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
                style={{ transitionDelay: open ? "160ms" : "0ms" }}
              >
                <p className="font-black uppercase tracking-wide text-slate-500">Profit / payroll</p>
                <p className="mt-0.5 font-black tabular-nums text-slate-900">
                  <AnimatedMoney value={profitPerPayroll} active={open} delay={160} />
                </p>
              </div>
            </div>
            <div
              className={`mt-2 flex items-center gap-2 transition-all duration-200 ${open ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDelay: open ? "200ms" : "0ms" }}
            >
              <div className="h-2 flex-1 overflow-hidden rounded-sm border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]">
                <div
                  className="h-full bg-emerald-400 transition-[width] duration-500 ease-out"
                  style={{ width: open ? `${progressPct}%` : "0%" }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-black tabular-nums text-slate-700">{progressPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
