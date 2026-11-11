"use client";

// THROWAWAY PROTOTYPE: static data, three wallet-style checklist headers.
// Rows are the existing look on purpose; only the header and summary change.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HeaderSearch from "@/components/header-search";
import ThemeToggle from "@/components/theme-toggle";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const DAY = {
  date: "WED, OCT 28",
  relative: "today",
  left: 34936.74,
  dueToday: 0,
  carried: 34936.74,
  profit: 0,
  month: 158940,
  paid: 0,
  count: 11,
  collected: 0,
  due: 34936.74,
};

const ROWS = [
  {
    name: "teofil norm tabanao",
    meta: "oct 21",
    late: "7d late",
    kind: "ca",
    amount: 10500,
    paid: false,
  },
  {
    name: "christine sobrepena",
    meta: "oct 23",
    late: null,
    kind: "loan",
    amount: 2646.67,
    paid: false,
  },
  {
    name: "colleen a…",
    meta: "4 due",
    late: "oldest 5d late",
    kind: "loan",
    amount: 1918.89,
    paid: false,
  },
  {
    name: "erma cabellon",
    meta: "oct 23",
    late: null,
    kind: "ca",
    amount: 3095,
    paid: true,
  },
  {
    name: "jennel lan…",
    meta: "2 due",
    late: "oldest 5d late",
    kind: "loan",
    amount: 474.68,
    paid: false,
  },
];

const KIND_DOT: Record<string, string> = {
  loan: "bg-purple-500",
  ca: "bg-yellow-400",
};

const FILTERS = ["all 11", "overdue 8", "today 0", "paid 3"];

/** The green full-bleed band: search row, then the date row. */
function Band({
  children,
  tall = false,
}: {
  children?: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative -mx-4 -mt-16 px-4 pt-4 text-white",
        tall ? "pb-24" : "pb-16",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-b-3xl bg-linear-to-b
          from-emerald-600 to-emerald-500"
      />
      <div className="relative z-20 flex items-center gap-3">
        <HeaderSearch onColor className="flex-1 sm:max-w-none" />
        <ThemeToggle size="icon-sm" />
        <span className="relative shrink-0">
          <Bell className="size-5" />
          <span
            className="absolute -top-1 -right-1 size-2.5 rounded-full
              bg-rose-400 ring-2 ring-emerald-600"
          />
        </span>
      </div>
      <div className="relative z-20 mt-3 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <ChevronLeft className="-ml-1 size-5 opacity-90" />
          <span className="text-xs font-bold tracking-wider">{DAY.date}</span>
          <span
            className="ml-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[11px]
              font-semibold"
          >
            {DAY.relative}
          </span>
          <ChevronRight className="size-5 opacity-90" />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex size-9 items-center justify-center rounded-full
              bg-white/20"
          >
            <MoreHorizontal className="size-5" />
          </span>
          <span
            className="flex size-9 items-center justify-center rounded-full
              bg-white text-emerald-600 shadow-sm"
          >
            <Plus className="size-5" />
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

const card =
  "rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10";

function Tabs() {
  const [tab, setTab] = useState<"collect" | "release">("collect");
  return (
    <div className="flex rounded-xl bg-secondary p-0.5 text-sm font-semibold">
      {(["collect", "release"] as const).map((k) => (
        <button
          key={k}
          onClick={() => setTab(k)}
          className={cn(
            "flex-1 rounded-[10px] py-1.5 capitalize",
            tab === k
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {k} {k === "collect" ? 11 : 4}
        </button>
      ))}
    </div>
  );
}

function Chips() {
  const [on, setOn] = useState(0);
  return (
    <div className="flex gap-2 overflow-x-auto">
      {FILTERS.map((f, i) => (
        <button
          key={f}
          onClick={() => setOn(i)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
            on === i
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function Rows() {
  return (
    <div
      className="mt-3 divide-y overflow-hidden rounded-2xl bg-card ring-1
        ring-black/5 dark:ring-white/10"
    >
      <p
        className="flex items-center justify-between bg-amber-50 px-4 py-2
          text-xs font-bold text-amber-800 dark:bg-amber-500/10
          dark:text-amber-300"
      >
        <span>carried over 0/11</span>
        <span>{peso(DAY.carried)}</span>
      </p>
      {ROWS.map((r) => (
        <div key={r.name} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-card-foreground/80">
              {r.name}
            </p>
            <p
              className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs
                font-semibold text-muted-foreground"
            >
              <span>{r.meta}</span>
              {r.late && (
                <span
                  className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px]
                    text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                >
                  {r.late}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className={cn("size-2 rounded-full", KIND_DOT[r.kind])} />
                {r.kind}
              </span>
            </p>
          </div>
          <span
            className="text-sm font-bold tabular-nums text-slate-700
              dark:text-slate-200"
          >
            {peso(r.amount)}
          </span>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full border",
              r.paid
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-border text-muted-foreground",
            )}
          >
            <Check className="size-4" />
          </span>
        </div>
      ))}
    </div>
  );
}

/* A · Floating summary card over the band */
function A() {
  const pct = 0;
  return (
    <>
      <Band tall />
      <div className="relative z-10 -mt-16 space-y-3">
        <div className={cn(card, "p-4")}>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-bold tracking-tight
                text-card-foreground/80 tabular-nums"
            >
              {peso(DAY.left)}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              left
            </span>
            <span
              className="ml-auto text-sm font-semibold text-muted-foreground
                tabular-nums"
            >
              {DAY.paid}/{DAY.count} paid
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100
              dark:bg-emerald-500/15"
          >
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted p-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground">
                due today
              </p>
              <p
                className="text-sm font-bold text-card-foreground/80
                  tabular-nums"
              >
                {peso(DAY.dueToday)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-500/10">
              <p
                className="text-[11px] font-semibold text-amber-700
                  dark:text-amber-400"
              >
                carried over
              </p>
              <p
                className="text-sm font-bold text-card-foreground/80
                  tabular-nums"
              >
                {peso(DAY.carried)}
              </p>
            </div>
            <div
              className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-500/10"
            >
              <p
                className="text-[11px] font-semibold text-emerald-700
                  dark:text-emerald-400"
              >
                profit
              </p>
              <p
                className="text-sm font-bold text-card-foreground/80
                  tabular-nums"
              >
                {peso(DAY.profit)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold text-emerald-600">
            {peso(DAY.month)} profit this month
          </p>
        </div>
        <Tabs />
        <Chips />
        <Rows />
      </div>
    </>
  );
}

/* B · Everything inside the band, tabs float */
function B() {
  return (
    <>
      <Band tall>
        <div className="relative mt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight tabular-nums">
              {peso(DAY.left)}
            </span>
            <span className="text-sm font-semibold opacity-80">left</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: "6%" }}
            />
          </div>
          <div
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs
              font-semibold"
          >
            <span>
              {DAY.paid}/{DAY.count} paid
            </span>
            <span>{peso(DAY.dueToday)} due today</span>
            <span className="text-amber-200">
              {peso(DAY.carried)} carried over
            </span>
          </div>
          <div
            className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1
              text-xs font-bold"
          >
            {peso(DAY.profit)} profit · {peso(DAY.month)} this month
          </div>
        </div>
      </Band>
      <div className="relative z-10 -mt-10 space-y-3">
        <div className={cn(card, "space-y-3 p-3")}>
          <Tabs />
          <Chips />
        </div>
        <Rows />
      </div>
    </>
  );
}

/* C · Ring + three stats */
function C() {
  const pct = 0;
  return (
    <>
      <Band tall />
      <div className="relative z-10 -mt-16 space-y-3">
        <div className={cn(card, "p-4")}>
          <div className="flex items-center gap-4">
            <div
              className="relative size-24 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(#34d399 ${pct * 3.6}deg, #d1fae5 0)`,
              }}
            >
              <div
                className="absolute inset-2.5 flex flex-col items-center
                  justify-center rounded-full bg-card"
              >
                <span className="text-lg font-bold text-emerald-600">
                  {DAY.paid}/{DAY.count}
                </span>
                <span
                  className="text-[10px] font-semibold text-muted-foreground"
                >
                  paid
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">
                left to collect
              </p>
              <p
                className="text-2xl font-bold tracking-tight
                  text-card-foreground/80 tabular-nums"
              >
                {peso(DAY.left)}
              </p>
              <p
                className="mt-1 text-xs font-semibold text-amber-700
                  dark:text-amber-400"
              >
                all {peso(DAY.carried)} carried over
              </p>
            </div>
          </div>
          <div
            className="mt-3 flex items-center justify-between rounded-xl
              bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10"
          >
            <span
              className="text-xs font-semibold text-emerald-700
                dark:text-emerald-400"
            >
              profit collected
            </span>
            <span
              className="text-sm font-bold text-card-foreground/80 tabular-nums"
            >
              {peso(DAY.profit)}{" "}
              <span className="text-xs font-semibold text-muted-foreground">
                · {peso(DAY.month)} this month
              </span>
            </span>
          </div>
        </div>
        <Tabs />
        <Chips />
        <Rows />
      </div>
    </>
  );
}

const VARIANTS = [
  { id: "A", name: "Floating card", el: <A /> },
  { id: "B", name: "All in header", el: <B /> },
  { id: "C", name: "Ring + stats", el: <C /> },
];

export default function ChecklistWalletMockup() {
  const [v, setV] = useState("A");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pinned above the bottom nav, portalled out of the page's transformed
  // wrapper so "fixed" really is the screen.
  const picker = (
    <div
      className="fixed inset-x-4 bottom-20 z-[60] mx-auto flex max-w-md gap-2
        rounded-full bg-background/90 p-1 shadow-lg ring-1 ring-black/10"
    >
      {VARIANTS.map((x) => (
        <button
          key={x.id}
          onClick={() => setV(x.id)}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-xs font-semibold",
            v === x.id ? "bg-foreground text-background" : "text-foreground",
          )}
        >
          {x.id} · {x.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-md px-4 pb-32">
      {/* The real page hides the global top bar; do the same here. */}
      <style>{`div.fixed.top-0.z-40{display:none}`}</style>
      {mounted && createPortal(picker, document.body)}
      {VARIANTS.find((x) => x.id === v)!.el}
    </div>
  );
}
