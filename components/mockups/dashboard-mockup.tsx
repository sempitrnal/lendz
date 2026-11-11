"use client";

// THROWAWAY PROTOTYPE: static data, three colourful dashboard directions.
import { useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  HandCoins,
  Receipt,
  Bell,
  Search,
  Home,
  ScanLine,
  Inbox,
  UserRound,
  Sparkles,
  ArrowDownLeft,
  Percent,
  CalendarClock,
  PiggyBank,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const peso = (n: number) => `₱${n.toLocaleString()}`;

const D = {
  outstanding: 8387547,
  principal: 5767096,
  profit: 2620451,
  overdue: 412300,
  overdueBorrowers: 6,
  duesToday: 38500,
  schedules: 9,
  avgProfit: 184200,
  borrowers: 128,
  delta: 4,
  month: "October 2026",
  toCollect: 1240000,
  collected: 830000,
  soFar: 1010000,
  expectedProfit: 312000,
  remainingProfit: 118000,
  months: [120, 150, 135, 170, 160, 190, 184, 210, 198, 225, 205, 240],
  aging: [
    { label: "1–7 d", v: 38, c: "bg-amber-200" },
    { label: "8–30 d", v: 27, c: "bg-orange-300" },
    { label: "31–60 d", v: 21, c: "bg-rose-300" },
    { label: "60+ d", v: 14, c: "bg-rose-400" },
  ],
};

const MONTHS = ["N", "D", "J", "F", "M", "A", "M", "J", "J", "A", "S", "O"];

function Bars({
  bar,
  max = 240,
  h = "h-28",
}: {
  bar: string;
  max?: number;
  h?: string;
}) {
  return (
    <div className={cn("flex items-end gap-1.5", h)}>
      {D.months.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn("w-full rounded-t-md", bar)}
            style={{ height: `${(v / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function Aging({ track }: { track: string }) {
  return (
    <div className="space-y-2.5">
      {D.aging.map((a) => (
        <div key={a.label} className="flex items-center gap-3 text-xs">
          <span className="w-12 shrink-0 opacity-70">{a.label}</span>
          <div className={cn("h-2.5 flex-1 rounded-full", track)}>
            <div
              className={cn("h-full rounded-full", a.c)}
              style={{ width: `${a.v}%` }}
            />
          </div>
          <span className="w-8 text-right font-semibold tabular-nums">
            {a.v}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────────── A · Bold colour tiles ───────────── */
function VariantA() {
  const tiles = [
    {
      label: "overdue",
      value: peso(D.overdue),
      hint: `${D.overdueBorrowers} borrowers`,
      icon: AlertTriangle,
      bg: "bg-rose-100 text-rose-900",
    },
    {
      label: "dues today",
      value: peso(D.duesToday),
      hint: `${D.schedules} schedules`,
      icon: CalendarClock,
      bg: "bg-amber-100 text-amber-900",
    },
    {
      label: "avg monthly profit",
      value: peso(D.avgProfit),
      hint: "last 6 full months",
      icon: TrendingUp,
      bg: "bg-sky-100 text-sky-900",
    },
    {
      label: "active borrowers",
      value: String(D.borrowers),
      hint: `+${D.delta} this week`,
      icon: Users,
      bg: "bg-violet-100 text-violet-900",
    },
  ];
  const pct = Math.round((D.collected / D.toCollect) * 100);
  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl bg-linear-to-br
          from-emerald-100 via-emerald-50 to-teal-100 p-5 text-emerald-950"
      >
        <div
          className="absolute -top-12 -right-12 size-44 rounded-full
            bg-white/10"
        />
        <div className="relative flex items-center justify-between text-sm">
          <span className="font-medium opacity-90">outstanding</span>
          <Wallet className="size-5 opacity-90" />
        </div>
        <p className="relative mt-2 text-3xl font-semibold tabular-nums">
          {peso(D.outstanding)}
        </p>
        <div
          className="relative mt-4 flex h-2 overflow-hidden rounded-full
            bg-white/20"
        >
          <div
            className="bg-emerald-400"
            style={{ width: `${(D.principal / D.outstanding) * 100}%` }}
          />
          <div className="flex-1 bg-amber-300" />
        </div>
        <div className="relative mt-2 flex justify-between text-xs">
          <span>principal {peso(D.principal)}</span>
          <span>profit {peso(D.profit)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={cn("rounded-2xl p-4", t.bg)}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium opacity-90">{t.label}</span>
              <t.icon className="size-4 opacity-90" />
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums">{t.value}</p>
            <p className="mt-1 text-xs opacity-80">{t.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-amber-100 p-5 text-amber-950">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <PiggyBank className="size-4" /> monthly collections
          </span>
          <span
            className="rounded-full bg-amber-950 px-2.5 py-0.5 text-xs
              text-amber-100"
          >
            {D.month}
          </span>
        </div>
        <p className="mt-3 text-3xl font-semibold tabular-nums">
          {peso(D.toCollect)}
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-950/15">
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs">
          <b>{pct}%</b> collected · {peso(D.collected)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sky-100 p-5 text-sky-950">
          <p className="mb-3 text-sm font-semibold">profit per month</p>
          <Bars bar="bg-sky-300" />
        </div>
        <div className="rounded-2xl bg-rose-100 p-5 text-rose-950">
          <p className="mb-3 text-sm font-semibold">overdue aging</p>
          <Aging track="bg-rose-950/10" />
        </div>
      </div>
    </div>
  );
}

/* ───────────── B · Colour-coded sections ───────────── */
function VariantB() {
  const rows = [
    {
      label: "overdue",
      value: peso(D.overdue),
      hint: `${D.overdueBorrowers} borrowers`,
      rail: "bg-rose-300",
      text: "text-rose-600",
      chip: "bg-rose-50 text-rose-700",
    },
    {
      label: "dues today",
      value: peso(D.duesToday),
      hint: `${D.schedules} schedules`,
      rail: "bg-amber-300",
      text: "text-amber-600",
      chip: "bg-amber-50 text-amber-700",
    },
    {
      label: "avg monthly profit",
      value: peso(D.avgProfit),
      hint: "last 6 full months",
      rail: "bg-sky-300",
      text: "text-sky-600",
      chip: "bg-sky-50 text-sky-700",
    },
    {
      label: "active borrowers",
      value: String(D.borrowers),
      hint: `+${D.delta} this week`,
      rail: "bg-violet-300",
      text: "text-violet-600",
      chip: "bg-violet-50 text-violet-700",
    },
  ];
  const pct = Math.round((D.collected / D.toCollect) * 100);
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-white">
        <div
          className="h-1.5 bg-linear-to-r from-emerald-400 via-amber-300
            to-emerald-600"
        />
        <div className="p-5">
          <p className="text-sm text-neutral-500">outstanding</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {peso(D.outstanding)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">principal</p>
              <p className="font-semibold text-emerald-800 tabular-nums">
                {peso(D.principal)}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-amber-700">profit</p>
              <p className="font-semibold text-amber-800 tabular-nums">
                {peso(D.profit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="relative overflow-hidden rounded-xl border bg-white p-4
              pl-5"
          >
            <span className={cn("absolute inset-y-0 left-0 w-1.5", r.rail)} />
            <p className="text-xs text-neutral-500">{r.label}</p>
            <p
              className={cn("mt-1 text-xl font-semibold tabular-nums", r.text)}
            >
              {r.value}
            </p>
            <span
              className={cn(
                "mt-2 inline-block rounded-full px-2 py-0.5 text-xs",
                r.chip,
              )}
            >
              {r.hint}
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div
          className="flex items-center justify-between bg-amber-500 px-5 py-3
            text-white"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <PiggyBank className="size-4" /> monthly collections
          </span>
          <span className="text-xs opacity-90">{D.month}</span>
        </div>
        <div className="p-5">
          <div className="flex items-end justify-between">
            <p className="text-3xl font-semibold tabular-nums">
              {peso(D.toCollect)}
            </p>
            <span
              className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs
                font-semibold text-emerald-700"
            >
              {pct}% collected
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-white">
          <div
            className="bg-sky-100 px-5 py-3 text-sm font-semibold text-sky-900"
          >
            profit per month
          </div>
          <div className="p-5">
            <Bars bar="bg-sky-300" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-white">
          <div
            className="bg-rose-100 px-5 py-3 text-sm font-semibold
              text-rose-900"
          >
            overdue aging
          </div>
          <div className="p-5">
            <Aging track="bg-neutral-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── C · Vivid dark ───────────── */
function VariantC() {
  const pct = Math.round((D.collected / D.toCollect) * 100);
  const chips = [
    {
      label: "overdue",
      value: peso(D.overdue),
      c: "text-rose-400",
      ring: "ring-rose-500/40",
      glow: "bg-rose-500/20",
    },
    {
      label: "dues today",
      value: peso(D.duesToday),
      c: "text-amber-300",
      ring: "ring-amber-400/40",
      glow: "bg-amber-400/20",
    },
    {
      label: "avg profit / mo",
      value: peso(D.avgProfit),
      c: "text-sky-300",
      ring: "ring-sky-400/40",
      glow: "bg-sky-400/20",
    },
    {
      label: "borrowers",
      value: String(D.borrowers),
      c: "text-violet-300",
      ring: "ring-violet-400/40",
      glow: "bg-violet-400/20",
    },
  ];
  return (
    <div className="space-y-4 rounded-3xl bg-neutral-950 p-4 text-neutral-50">
      <div
        className="relative overflow-hidden rounded-2xl bg-linear-to-br
          from-emerald-500/30 via-neutral-900 to-neutral-900 p-5 ring-1
          ring-emerald-400/30"
      >
        <div
          className="absolute -top-16 -right-10 size-48 rounded-full
            bg-emerald-400/20 blur-3xl"
        />
        <p className="relative text-sm text-neutral-300">outstanding</p>
        <p className="relative mt-1 text-4xl font-semibold tabular-nums">
          {peso(D.outstanding)}
        </p>
        <div
          className="relative mt-4 flex h-2.5 overflow-hidden rounded-full
            bg-white/10"
        >
          <div
            className="bg-emerald-400"
            style={{ width: `${(D.principal / D.outstanding) * 100}%` }}
          />
          <div className="flex-1 bg-amber-300" />
        </div>
        <div
          className="relative mt-2 flex justify-between text-xs
            text-neutral-300"
        >
          <span className="text-emerald-300">
            ● principal {peso(D.principal)}
          </span>
          <span className="text-amber-300">● profit {peso(D.profit)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {chips.map((c) => (
          <div
            key={c.label}
            className={cn(
              "relative overflow-hidden rounded-2xl bg-neutral-900 p-4 ring-1",
              c.ring,
            )}
          >
            <div
              className={cn(
                "absolute -right-6 -bottom-6 size-20 rounded-full blur-2xl",
                c.glow,
              )}
            />
            <p className="relative text-xs text-neutral-400">{c.label}</p>
            <p
              className={cn(
                "relative mt-1 text-xl font-semibold tabular-nums",
                c.c,
              )}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-amber-400/30">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-semibold text-amber-300">
            <PiggyBank className="size-4" /> monthly collections
          </span>
          <span className="text-xs text-neutral-400">{D.month}</span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-3xl font-semibold tabular-nums">
            {peso(D.toCollect)}
          </p>
          <span className="text-sm font-semibold text-emerald-300">{pct}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-400
              to-lime-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-sky-400/30">
          <p className="mb-3 text-sm font-semibold text-sky-300">
            profit per month
          </p>
          <Bars bar="bg-linear-to-t from-sky-600 to-cyan-300" />
        </div>
        <div className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-rose-400/30">
          <p className="mb-3 text-sm font-semibold text-rose-300">
            overdue aging
          </p>
          <Aging track="bg-white/10" />
        </div>
      </div>
    </div>
  );
}

/* ───────────── D · Wallet home (GCash-style) ───────────── */
function VariantD() {
  const [hide, setHide] = useState(false);
  const pct = Math.round((D.collected / D.toCollect) * 100);
  const mask = (t: string) => (hide ? "••••••" : t);
  const actions = [
    {
      label: "Overdue",
      icon: AlertTriangle,
      bg: "bg-rose-100 text-rose-600",
      badge: D.overdueBorrowers,
    },
    {
      label: "Due today",
      icon: CalendarClock,
      bg: "bg-amber-100 text-amber-600",
      badge: D.schedules,
    },
    {
      label: "Borrowers",
      icon: Users,
      bg: "bg-sky-100 text-sky-600",
      badge: null,
    },
    {
      label: "Profit",
      icon: TrendingUp,
      bg: "bg-violet-100 text-violet-600",
      badge: null,
    },
    {
      label: "New loan",
      icon: HandCoins,
      bg: "bg-emerald-100 text-emerald-600",
      badge: null,
    },
    {
      label: "Payments",
      icon: Receipt,
      bg: "bg-teal-100 text-teal-600",
      badge: null,
    },
    {
      label: "Rates",
      icon: Percent,
      bg: "bg-orange-100 text-orange-600",
      badge: null,
    },
    {
      label: "More",
      icon: ChevronRight,
      bg: "bg-neutral-100 text-neutral-600",
      badge: null,
    },
  ];
  return (
    <div className="overflow-hidden rounded-3xl bg-neutral-100">
      <div
        className="bg-linear-to-b from-emerald-600 to-emerald-500 px-4 pt-5
          pb-16 text-white"
      >
        <p className="text-sm opacity-90">Hi, Reynald 👋</p>
        <p className="text-xs opacity-70">{D.month}</p>
      </div>
      <div className="-mt-12 space-y-4 px-4 pb-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div
            className="flex items-center justify-between text-sm
              text-neutral-500"
          >
            <span>Outstanding balance</span>
            <button onClick={() => setHide(!hide)} aria-label="toggle">
              {hide ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p
            className="mt-1 text-3xl font-bold tracking-tight text-neutral-900
              tabular-nums"
          >
            {mask(peso(D.outstanding))}
          </p>
          <div className="mt-3 grid grid-cols-2 divide-x text-sm">
            <div>
              <p className="text-xs text-neutral-500">Principal</p>
              <p className="font-semibold text-neutral-800 tabular-nums">
                {mask(peso(D.principal))}
              </p>
            </div>
            <div className="pl-4">
              <p className="text-xs text-neutral-500">Profit</p>
              <p className="font-semibold text-emerald-600 tabular-nums">
                {mask(peso(D.profit))}
              </p>
            </div>
          </div>
        </div>

        <div
          className="grid grid-cols-4 gap-y-4 rounded-2xl bg-white p-4
            shadow-sm"
        >
          {actions.map((a) => (
            <div key={a.label} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  `relative flex size-12 items-center justify-center
                  rounded-full`,
                  a.bg,
                )}
              >
                <a.icon className="size-5" />
                {a.badge ? (
                  <span
                    className="absolute -top-1 -right-1 flex size-5 items-center
                      justify-center rounded-full bg-rose-500 text-[10px]
                      font-bold text-white"
                  >
                    {a.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] text-neutral-700">{a.label}</span>
            </div>
          ))}
        </div>

        <div
          className="relative overflow-hidden rounded-2xl bg-linear-to-r
            from-emerald-100 to-teal-100 p-4"
        >
          <div
            className="absolute -right-6 -bottom-8 size-28 rounded-full
              bg-white/50"
          />
          <p className="relative text-xs font-medium text-emerald-800">
            Monthly collections
          </p>
          <p
            className="relative mt-0.5 text-xl font-bold text-emerald-950
              tabular-nums"
          >
            {peso(D.collected)}{" "}
            <span className="text-sm font-medium text-emerald-700">
              of {peso(D.toCollect)}
            </span>
          </p>
          <div
            className="relative mt-3 h-2.5 overflow-hidden rounded-full
              bg-white/70"
          >
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="relative mt-1.5 text-xs text-emerald-800">
            {pct}% collected · keep going!
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-800">
              Profit per month
            </p>
            <span className="flex items-center text-xs text-emerald-600">
              See all <ChevronRight className="size-3" />
            </span>
          </div>
          <Bars bar="bg-emerald-300" h="h-24" />
          <div className="mt-1 flex gap-1.5 text-[10px] text-neutral-400">
            {MONTHS.map((m, i) => (
              <span key={i} className="flex-1 text-center">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── E · Activity feed (GCash transactions) ───────────── */
function VariantE() {
  const rows = [
    {
      t: "Overdue",
      s: `${D.overdueBorrowers} borrowers`,
      v: peso(D.overdue),
      icon: AlertTriangle,
      bg: "bg-rose-100 text-rose-600",
      neg: true,
    },
    {
      t: "Dues today",
      s: `${D.schedules} schedules`,
      v: peso(D.duesToday),
      icon: CalendarClock,
      bg: "bg-amber-100 text-amber-600",
    },
    {
      t: "Avg monthly profit",
      s: "last 6 full months",
      v: peso(D.avgProfit),
      icon: TrendingUp,
      bg: "bg-sky-100 text-sky-600",
    },
    {
      t: "Active borrowers",
      s: `+${D.delta} this week`,
      v: String(D.borrowers),
      icon: Users,
      bg: "bg-violet-100 text-violet-600",
    },
    {
      t: "Collected this month",
      s: D.month,
      v: peso(D.collected),
      icon: PiggyBank,
      bg: "bg-emerald-100 text-emerald-600",
    },
  ];
  return (
    <div className="overflow-hidden rounded-3xl bg-emerald-600">
      <div className="px-5 pt-6 pb-8 text-white">
        <div className="flex items-center justify-between text-sm">
          <span className="opacity-90">Total outstanding</span>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">
            {D.month}
          </span>
        </div>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
          {peso(D.outstanding)}
        </p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs">
            Principal {peso(D.principal)}
          </span>
          <span
            className="rounded-full bg-amber-300 px-3 py-1 text-xs font-medium
              text-amber-950"
          >
            Profit {peso(D.profit)}
          </span>
        </div>
      </div>
      <div className="rounded-t-3xl bg-white p-5">
        <p className="mb-1 text-sm font-semibold text-neutral-800">
          Today at a glance
        </p>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.t} className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  r.bg,
                )}
              >
                <r.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-800">{r.t}</p>
                <p className="text-xs text-neutral-500">{r.s}</p>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  r.neg ? "text-rose-600" : "text-neutral-900",
                )}
              >
                {r.v}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 mb-2 text-sm font-semibold text-neutral-800">
          Collection progress
        </p>
        <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{
              width: `${Math.round((D.collected / D.toCollect) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          {peso(D.collected)} of {peso(D.toCollect)}
        </p>
        <p className="mt-5 mb-2 text-sm font-semibold text-neutral-800">
          Overdue aging
        </p>
        <Aging track="bg-neutral-100" />
      </div>
    </div>
  );
}

/* ───────────── F · Wallet home, expanded ───────────── */
const PAYMENTS = [
  {
    n: "Maria Santos",
    s: "Today · 9:41 AM",
    v: "+₱4,500",
    icon: ArrowDownLeft,
    ok: true,
  },
  {
    n: "Jose Ramirez",
    s: "Today · 8:15 AM",
    v: "+₱2,000",
    icon: ArrowDownLeft,
    ok: true,
  },
  {
    n: "Ana Dizon",
    s: "Yesterday · overdue 3d",
    v: "₱6,200",
    icon: AlertTriangle,
    ok: false,
  },
  {
    n: "Pedro Cruz",
    s: "Yesterday · partial",
    v: "+₱1,000",
    icon: ArrowDownLeft,
    ok: true,
  },
];

function VariantF() {
  const [hide, setHide] = useState(false);
  const [tab, setTab] = useState<"outstanding" | "profit">("outstanding");
  const pct = Math.round((D.collected / D.toCollect) * 100);
  const mask = (t: string) => (hide ? "••••••" : t);
  const shortcuts = [
    {
      label: "Overdue",
      icon: AlertTriangle,
      bg: "bg-rose-100 text-rose-600",
      badge: D.overdueBorrowers,
    },
    {
      label: "Due today",
      icon: CalendarClock,
      bg: "bg-amber-100 text-amber-600",
      badge: D.schedules,
    },
    {
      label: "Borrowers",
      icon: Users,
      bg: "bg-sky-100 text-sky-600",
      badge: 0,
    },
    {
      label: "New loan",
      icon: HandCoins,
      bg: "bg-emerald-100 text-emerald-500",
      badge: 0,
    },
  ];
  const promos = [
    {
      t: "9 dues today",
      s: "Collect before 5 PM",
      bg: "from-amber-200 to-orange-100",
      c: "text-amber-900",
      icon: CalendarClock,
    },
    {
      t: "6 borrowers overdue",
      s: "Send a reminder",
      bg: "from-rose-200 to-pink-100",
      c: "text-rose-900",
      icon: Bell,
    },
    {
      t: "67% of goal",
      s: "₱410,000 to go",
      bg: "from-emerald-200 to-teal-100",
      c: "text-emerald-900",
      icon: Sparkles,
    },
  ];
  return (
    <div className="overflow-hidden rounded-3xl bg-neutral-100">
      <div
        className="bg-linear-to-b from-emerald-600 to-emerald-500 px-4 pt-4
          pb-20 text-white"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-full
              bg-white/25 text-sm font-bold"
          >
            R
          </span>
          <div
            className="flex h-9 flex-1 items-center gap-2 rounded-full
              bg-white/20 px-3 text-sm text-white/80"
          >
            <Search className="size-4" /> Search borrowers
          </div>
          <span className="relative">
            <Bell className="size-5" />
            <span
              className="absolute -top-1 -right-1 size-2.5 rounded-full
                bg-rose-400 ring-2 ring-emerald-600"
            />
          </span>
        </div>
      </div>

      <div className="-mt-16 space-y-4 px-4 pb-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex gap-1 bg-emerald-50 p-1.5">
            {(["outstanding", "profit"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "flex-1 rounded-xl py-1.5 text-xs font-semibold capitalize",
                  tab === k
                    ? "bg-white text-emerald-600 shadow-sm"
                    : "text-emerald-600/60",
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="p-4">
            <div
              className="flex items-center justify-between text-xs
                text-neutral-500 font-semibold"
            >
              <span>
                {tab === "outstanding"
                  ? "Outstanding balance"
                  : "Profit still to earn"}
              </span>
              <button onClick={() => setHide(!hide)} aria-label="toggle">
                {hide ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p
              className="mt-1 text-3xl font-bold tracking-tight text-neutral-700
                tabular-nums"
            >
              {mask(peso(tab === "outstanding" ? D.outstanding : D.profit))}
            </p>
            <div
              className="mt-3 flex h-2 overflow-hidden rounded-full
                bg-neutral-100"
            >
              <div
                className="bg-emerald-400"
                style={{ width: `${(D.principal / D.outstanding) * 100}%` }}
              />
              <div className="flex-1 bg-amber-300" />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-neutral-500 font-semibold">
                ● Principal{" "}
                <b className="text-neutral-600">{mask(peso(D.principal))}</b>
              </span>
              <span className="text-neutral-500 font-semibold">
                ● Profit{" "}
                <b className="text-neutral-600">{mask(peso(D.profit))}</b>
              </span>
            </div>
          </div>
        </div>

        <div
          className="grid grid-cols-4 gap-2 rounded-2xl bg-white p-4 shadow-sm"
        >
          {shortcuts.map((a) => (
            <div key={a.label} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  `relative flex size-12 items-center justify-center
                  rounded-full`,
                  a.bg,
                )}
              >
                <a.icon className="size-5" />
                {a.badge ? (
                  <span
                    className="absolute -top-1 -right-1 flex size-5 items-center
                      justify-center rounded-full bg-rose-500 text-[10px]
                      font-bold text-white"
                  >
                    {a.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] text-neutral-700">{a.label}</span>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 px-1 text-sm font-bold text-neutral-600">
            For you today
          </p>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {promos.map((p) => (
              <div
                key={p.t}
                className={cn(
                  `relative w-56 shrink-0 snap-start overflow-hidden rounded-2xl
                  bg-linear-to-br p-4`,
                  p.bg,
                  p.c,
                )}
              >
                <p.icon
                  className="absolute -right-2 -bottom-2 size-20 opacity-15"
                />
                <p className="relative text-base font-bold">{p.t}</p>
                <p className="relative mt-0.5 text-xs opacity-80">{p.s}</p>
                <span
                  className="relative mt-3 inline-block rounded-full bg-white/70
                    px-3 py-1 text-xs font-bold"
                >
                  Open
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-neutral-600">
              Monthly collections
            </p>
            <span className="text-xs text-neutral-500 font-semibold">
              {D.month}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div
              className="relative size-20 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(#34d399 ${pct * 3.6}deg, #d1fae5 0)`,
              }}
            >
              <div
                className="absolute inset-2 flex items-center justify-center
                  rounded-full bg-white text-lg font-bold text-emerald-600"
              >
                {pct}%
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-neutral-500 font-semibold">
                Collected
              </p>
              <p className="text-lg font-bold text-neutral-700 tabular-nums">
                {peso(D.collected)}
              </p>
              <p className="text-xs text-neutral-500 font-semibold">
                of {peso(D.toCollect)} · profit {peso(D.expectedProfit)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-bold text-neutral-600">
              Recent payments
            </p>
            <span className="flex items-center text-xs text-emerald-500">
              See all <ChevronRight className="size-3" />
            </span>
          </div>
          <ul className="divide-y">
            {PAYMENTS.map((r) => (
              <li key={r.n} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full",
                    r.ok
                      ? "bg-emerald-100 text-emerald-500"
                      : "bg-rose-100 text-rose-600",
                  )}
                >
                  <r.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-600">
                    {r.n}
                  </p>
                  <p className="text-xs text-neutral-500 font-semibold">
                    {r.s}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    r.ok ? "text-emerald-500" : "text-rose-600",
                  )}
                >
                  {r.v}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-bold text-neutral-600">
            Profit per month
          </p>
          <Bars bar="bg-emerald-300" h="h-24" />
          <div className="mt-1 flex gap-1.5 text-[10px] text-neutral-400">
            {MONTHS.map((m, i) => (
              <span key={i} className="flex-1 text-center">
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-bold text-neutral-600">
            Overdue aging
          </p>
          <Aging track="bg-neutral-100" />
        </div>
      </div>

      <div
        className="relative flex items-end justify-around border-t bg-white px-2
          pt-2 pb-3 text-[10px] text-neutral-500 font-semibold"
      >
        {[
          { l: "Home", i: Home, on: true },
          { l: "Inbox", i: Inbox, on: false },
        ].map((n) => (
          <span
            key={n.l}
            className={cn(
              "flex flex-col items-center gap-0.5",
              n.on && "text-emerald-500",
            )}
          >
            <n.i className="size-5" />
            {n.l}
          </span>
        ))}
        <span
          className="-mt-8 flex size-14 items-center justify-center rounded-full
            bg-emerald-500 text-white shadow-lg ring-4 ring-white"
        >
          <ScanLine className="size-6" />
        </span>
        {[
          { l: "Borrowers", i: Users },
          { l: "Profile", i: UserRound },
        ].map((n) => (
          <span key={n.l} className="flex flex-col items-center gap-0.5">
            <n.i className="size-5" />
            {n.l}
          </span>
        ))}
      </div>
    </div>
  );
}

const VARIANTS = [
  { id: "F", name: "Wallet home+", el: <VariantF />, own: true },
  { id: "D", name: "Wallet home", el: <VariantD />, own: true },
  { id: "E", name: "Activity feed", el: <VariantE />, own: true },
  { id: "A", name: "Bold colour tiles", el: <VariantA />, own: false },
  { id: "B", name: "Colour-coded sections", el: <VariantB />, own: false },
  { id: "C", name: "Vivid dark", el: <VariantC />, own: false },
];

const BACKDROPS = [
  {
    id: "mint",
    name: "Mint",
    cls: "bg-linear-to-b from-emerald-100 via-emerald-50 to-teal-100",
  },
  {
    id: "sunset",
    name: "Sunset",
    cls: "bg-linear-to-b from-amber-200 via-rose-100 to-orange-100",
  },
  {
    id: "ocean",
    name: "Ocean",
    cls: "bg-linear-to-b from-sky-200 via-indigo-100 to-cyan-100",
  },
  {
    id: "forest",
    name: "Forest",
    cls: "bg-linear-to-b from-emerald-900 via-emerald-950 to-neutral-950",
  },
];

export default function DashboardMockup() {
  const [v, setV] = useState("F");
  const [bg, setBg] = useState("mint");
  const current = VARIANTS.find((x) => x.id === v)!;
  const backdrop = BACKDROPS.find((x) => x.id === bg)!;
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {VARIANTS.map((x) => (
          <button
            key={x.id}
            onClick={() => setV(x.id)}
            className={cn(
              "flex-1 rounded-full border px-3 py-2 text-xs font-medium",
              v === x.id ? "bg-foreground text-background" : "bg-card",
            )}
          >
            {x.id} · {x.name}
          </button>
        ))}
      </div>
      <div className={cn("flex gap-2", current.own && "hidden")}>
        {BACKDROPS.map((x) => (
          <button
            key={x.id}
            onClick={() => setBg(x.id)}
            className={cn(
              "flex-1 rounded-full border px-3 py-1.5 text-xs font-medium",
              bg === x.id ? "bg-foreground text-background" : "bg-card",
            )}
          >
            {x.name}
          </button>
        ))}
      </div>
      {current.own ? (
        current.el
      ) : (
        <div className={cn("rounded-3xl p-3", backdrop.cls)}>{current.el}</div>
      )}
    </div>
  );
}
