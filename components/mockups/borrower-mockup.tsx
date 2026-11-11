"use client";

// THROWAWAY PROTOTYPE: static data, three borrower-page directions in the
// dashboard's wallet look (green band + floating cards, no sticky strip).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ChevronDown,
  Eye,
  EyeOff,
  HandCoins,
  Landmark,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HeaderSearch from "@/components/header-search";
import ThemeToggle from "@/components/theme-toggle";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const B = {
  name: "teofil norm tabanao",
  contact: "0917 555 0142",
  initials: "TT",
  categories: [
    { name: "teachers", color: "#a78bfa" },
    { name: "rolling", color: "#34d399" },
  ],
  loaned: 48000,
  collected: 31200,
  remaining: 22780,
  profitExpected: 9600,
  profitCollected: 6240,
  profitPerSchedule: 480,
  pct: 65,
  toPayMonth: 5400,
  paidMonth: 2000,
};

type Kind = "loan" | "ca" | "flat" | "pending";

type Acc = {
  id: string;
  kind: Kind;
  principal: number;
  meta: string;
  status: "active" | "pending";
  released: string;
  left: number;
  paidPct: number;
  next?: string;
  overdue?: number;
  dots?: ("paid" | "next" | "later" | "overdue")[];
};

const ACCOUNTS: Acc[] = [
  {
    id: "1",
    kind: "loan",
    principal: 20000,
    meta: "10% · bimonthly · 4mo",
    status: "active",
    released: "released 46 days ago",
    left: 8400,
    paidPct: 58,
    next: "Nov 3 · ₱2,100",
    dots: ["paid", "paid", "paid", "paid", "paid", "next"],
  },
  {
    id: "2",
    kind: "ca",
    principal: 10500,
    meta: "5% · weekly · 2mo",
    status: "active",
    released: "released 23 days ago",
    left: 10500,
    paidPct: 0,
    next: "Oct 21 · ₱1,312",
    overdue: 2,
    dots: ["overdue", "overdue", "next", "later", "later", "later"],
  },
  {
    id: "3",
    kind: "flat",
    principal: 15000,
    meta: "12% · manual flat",
    status: "active",
    released: "released 3 months ago",
    left: 3880,
    paidPct: 74,
  },
  {
    id: "4",
    kind: "pending",
    principal: 2500,
    meta: "pending",
    status: "pending",
    released: "not released yet",
    left: 2500,
    paidPct: 0,
  },
];

const KIND = {
  loan: {
    label: "loans",
    icon: Landmark,
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  ca: {
    label: "cash advances",
    icon: HandCoins,
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    dot: "bg-amber-400",
  },
  flat: {
    label: "manual flat loans",
    icon: Landmark,
    chip: "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200",
    dot: "bg-lime-500",
  },
  pending: {
    label: "pending",
    icon: Clock,
    chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    dot: "bg-slate-400",
  },
} as const;

const card =
  "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10";

/** The persistent green top bar the real page would keep (see MobileTopBar). */
function TopBar() {
  return (
    <div
      data-mock-bar
      className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center gap-2
        bg-emerald-600 px-4 sm:hidden dark:bg-emerald-950"
    >
      <button
        type="button"
        aria-label="Go back"
        className="flex size-9 shrink-0 items-center justify-center rounded-full
          bg-white/20 text-white"
      >
        <ArrowLeft className="size-4" strokeWidth={2.5} />
      </button>
      <HeaderSearch className="flex-1" onColor />
      <ThemeToggle size="icon-sm" />
      <span className="relative shrink-0 text-white">
        <Bell className="size-5" aria-hidden="true" />
        <span
          className="absolute -top-1 -right-1 size-2.5 rounded-full bg-rose-400
            ring-2 ring-emerald-600"
        />
      </span>
    </div>
  );
}

/** The green wash behind the cards. `tall` leaves room for a deeper overlap. */
function Band({
  children,
  pb = "pb-20",
}: {
  children: React.ReactNode;
  pb?: string;
}) {
  return (
    <div className={cn("relative -mx-4 px-4 pt-6 text-white", pb)}>
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-b-3xl bg-linear-to-b
          from-emerald-600 to-emerald-500 dark:from-emerald-950
          dark:to-emerald-900"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function Avatar() {
  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-full
        bg-white/20 text-base font-black tracking-tight"
    >
      {B.initials}
    </span>
  );
}

function Menu({
  onColor = true,
  small = false,
}: {
  onColor?: boolean;
  small?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        small ? "size-8" : "size-9",
        onColor ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
      )}
    >
      <MoreVertical className="size-5" />
    </span>
  );
}

function CategoryChips({ onColor = true }: { onColor?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {B.categories.map((c) => (
        <span
          key={c.name}
          className={cn(
            `flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px]
            font-semibold`,
            onColor ? "bg-white/20 text-white" : "bg-muted text-foreground/70",
          )}
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: c.color }}
          />
          {c.name}
        </span>
      ))}
    </div>
  );
}

function Ring({ pct, size = "size-20" }: { pct: number; size?: string }) {
  return (
    <div
      className={cn("relative shrink-0 rounded-full", size)}
      style={{
        background: `conic-gradient(#34d399 ${pct * 3.6}deg, #d1fae5 0)`,
      }}
    >
      <div
        className="absolute inset-2 flex items-center justify-center
          rounded-full bg-card text-lg font-bold text-emerald-500"
      >
        {pct}%
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={cn("rounded-xl p-2.5", tone)}>
      <p className="text-[11px] font-semibold opacity-70">{label}</p>
      <p className="text-sm font-bold text-card-foreground/80 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Dots({ dots }: { dots: NonNullable<Acc["dots"]> }) {
  const style = {
    paid: "border-emerald-500 bg-emerald-500 text-white",
    next: "border-yellow-400 bg-yellow-50",
    later: "border-slate-300 dark:border-slate-600",
    overdue: "border-rose-400 bg-rose-100 dark:bg-rose-900/40",
  } as const;
  return (
    <div className="mt-3 flex gap-1.5">
      {dots.map((d, i) => (
        <span
          key={i}
          className={cn(
            "flex size-6 items-center justify-center rounded-md border-2",
            style[d],
          )}
        >
          {d === "paid" && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      ))}
    </div>
  );
}

/** One account as a wallet card: kind chip, principal, progress, what's next. */
function AccountCard({ a }: { a: Acc }) {
  const k = KIND[a.kind];
  return (
    <div className={cn(card, "relative")}>
      <div className="flex items-center gap-2 pr-8">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold",
            k.chip,
          )}
        >
          {a.kind === "pending" ? "pending" : k.label.replace(/s$/, "")}
        </span>
        <span
          className="truncate text-[11px] font-semibold text-muted-foreground"
        >
          {a.meta}
        </span>
      </div>
      <MoreVertical
        className="absolute top-3.5 right-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
        principal
      </p>
      <p
        className="truncate text-[28px] leading-none font-black tracking-tight
          text-[#3b4a5f] tabular-nums [-webkit-text-stroke:0.6px_currentColor]
          dark:text-foreground"
      >
        {peso(a.principal)}
      </p>
      {a.kind === "pending" ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
            Pending activation
          </span>
          <span
            className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold
              text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          >
            Activate
          </span>
        </div>
      ) : (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${a.paidPct}%` }}
            />
          </div>
          <div
            className="mt-1.5 flex justify-between text-xs font-semibold
              text-muted-foreground"
          >
            <span className="tabular-nums">{peso(a.left)} left</span>
            <span>{a.paidPct}% paid</span>
          </div>
          {a.dots && <Dots dots={a.dots} />}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {a.next && (
              <span
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px]
                  font-bold text-amber-800 dark:bg-amber-500/15
                  dark:text-amber-300"
              >
                next {a.next}
              </span>
            )}
            {a.overdue && (
              <span
                className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px]
                  font-bold text-rose-700 dark:bg-rose-500/15
                  dark:text-rose-300"
              >
                {a.overdue} overdue
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GroupHeading({ kind, count }: { kind: Kind; count: number }) {
  const k = KIND[kind];
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <span
        className={cn(
          `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs
          font-bold`,
          k.chip,
        )}
      >
        <k.icon className="size-3.5" aria-hidden="true" />
        {k.label}
      </span>
      <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
        {count}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Accounts as stacked wallet cards, grouped by kind. */
function AccountGroups() {
  const kinds: Kind[] = ["loan", "ca", "flat", "pending"];
  return (
    <div className="space-y-5">
      {kinds.map((k) => {
        const list = ACCOUNTS.filter((a) => a.kind === k);
        if (list.length === 0) return null;
        return (
          <div key={k}>
            <GroupHeading kind={k} count={list.length} />
            <div className="space-y-3">
              {list.map((a) => (
                <AccountCard key={a.id} a={a} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Shortcuts({
  items,
}: {
  items: { label: string; icon: typeof Plus; tone: string }[];
}) {
  return (
    <div className={cn(card, "grid grid-cols-4 gap-2")}>
      {items.map((a) => (
        <div key={a.label} className="flex flex-col items-center gap-1.5">
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-full",
              a.tone,
            )}
          >
            <a.icon className="size-5" aria-hidden="true" />
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {a.label}
          </span>
        </div>
      ))}
    </div>
  );
}

const SHORTCUTS = [
  {
    label: "New loan",
    icon: Plus,
    tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  {
    label: "Add note",
    icon: StickyNote,
    tone: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  },
  {
    label: "Copy amounts",
    icon: Copy,
    tone: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  },
  {
    label: "Edit",
    icon: Pencil,
    tone: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  },
];

function MonthTiles() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div
        className="rounded-2xl bg-linear-to-br from-amber-200 to-orange-100 p-4
          text-amber-900 dark:from-amber-500/25 dark:to-orange-500/10
          dark:text-amber-200"
      >
        <p className="text-xs font-semibold opacity-80">to pay this month</p>
        <p className="mt-0.5 text-xl font-black tabular-nums">
          {peso(B.toPayMonth)}
        </p>
      </div>
      <div
        className="rounded-2xl bg-linear-to-br from-emerald-200 to-teal-100 p-4
          text-emerald-900 dark:from-emerald-500/25 dark:to-teal-500/10
          dark:text-emerald-200"
      >
        <p className="text-xs font-semibold opacity-80">paid this month</p>
        <p className="mt-0.5 text-xl font-black tabular-nums">
          {peso(B.paidMonth)}
        </p>
      </div>
    </div>
  );
}

const NOTES = [
  {
    t: "Pays on payday, text the day before",
    c: "bg-yellow-100 text-yellow-900",
  },
  { t: "Co-maker: sister, 0917 555 0188", c: "bg-sky-100 text-sky-900" },
];

function Notes() {
  return (
    <div>
      <p className="mb-2 px-1 text-sm font-bold text-card-foreground/80">
        Notes
      </p>
      <div className="grid grid-cols-2 gap-3">
        {NOTES.map((n) => (
          <div
            key={n.t}
            className={cn(
              "min-h-24 rounded-2xl p-3 text-sm font-semibold shadow-sm",
              n.c,
            )}
          >
            {n.t}
          </div>
        ))}
      </div>
    </div>
  );
}

function Deleted() {
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-card-foreground/80">
          Recently deleted{" "}
          <span className="text-xs font-semibold text-muted-foreground">
            · 1 account
          </span>
        </p>
        <span className="text-xs font-bold text-rose-500">clear all</span>
      </div>
      <div className="mt-3 flex items-center gap-3 opacity-70">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tabular-nums">{peso(5000)}</p>
          <p className="text-xs font-semibold text-muted-foreground">
            loan · bimonthly · deleted Oct 12
          </p>
        </div>
        <span
          className="flex size-8 items-center justify-center rounded-full
            bg-muted"
        >
          <RotateCcw className="size-3.5" />
        </span>
        <span
          className="flex size-8 items-center justify-center rounded-full
            bg-rose-100 text-rose-600 dark:bg-rose-500/15"
        >
          <Trash2 className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

/** Account card close to today's: a tinted header band, then the figures. */
function ClassicCard({ a }: { a: Acc }) {
  const k = KIND[a.kind];
  const band = {
    loan: "bg-violet-100/70 dark:bg-violet-950/30",
    ca: "bg-amber-50 dark:bg-amber-950/20",
    flat: "bg-lime-100/70 dark:bg-lime-950/30",
    pending: "bg-slate-100 dark:bg-white/5",
  }[a.kind];
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-card shadow-sm ring-1
        ring-black/5 dark:ring-white/10"
    >
      <div className={cn("flex items-center gap-2.5 py-2 pr-10 pl-3", band)}>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            k.chip,
          )}
        >
          <k.icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold text-slate-800
              dark:text-slate-100"
          >
            {a.released}
          </p>
          <p
            className="truncate text-[11px] font-medium text-slate-600
              dark:text-slate-300"
          >
            {a.meta} ·{" "}
            <span
              className="font-semibold text-emerald-700 dark:text-emerald-300"
            >
              {a.status}
            </span>
          </p>
        </div>
      </div>
      <MoreVertical
        className="absolute top-2.5 right-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="px-4 pt-3 pb-3">
        <p
          className="text-[11px] font-medium text-slate-600 dark:text-slate-300"
        >
          principal
        </p>
        <p
          className="truncate text-[28px] leading-none font-black tracking-tight
            text-[#3b4a5f] tabular-nums [-webkit-text-stroke:0.6px_currentColor]
            dark:text-foreground"
        >
          {peso(a.principal)}
        </p>
        {a.kind === "pending" ? (
          <p
            className="mt-2 text-xs font-bold text-amber-700
              dark:text-amber-300"
          >
            Pending activation
          </p>
        ) : (
          <>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100
                dark:bg-slate-800"
            >
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${a.paidPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs">
              <span
                className="font-semibold text-slate-600 tabular-nums
                  dark:text-slate-300"
              >
                {peso(a.left)} left
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {a.paidPct}% paid
              </span>
            </div>
            {a.dots && <Dots dots={a.dots} />}
            {(a.next || a.overdue) && (
              <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-300">
                {a.next && (
                  <>
                    next{" "}
                    <b
                      className="font-extrabold text-slate-800
                        dark:text-slate-100"
                    >
                      {a.next}
                    </b>
                  </>
                )}
                {a.overdue && (
                  <b className="font-extrabold text-rose-600 dark:text-rose-400">
                    {a.next ? " · " : ""}
                    {a.overdue} overdue
                  </b>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClassicGroups({ overlap = false }: { overlap?: boolean }) {
  const kinds: Kind[] = ["loan", "ca", "flat", "pending"];
  return (
    <div className="space-y-6">
      {kinds.map((k, ki) => {
        const list = ACCOUNTS.filter((a) => a.kind === k);
        if (list.length === 0) return null;
        return (
          <div key={k}>
            <GroupHeading kind={k} count={list.length} />
            <div className="space-y-4">
              {list.map((a) => (
                <ClassicCard key={a.id} a={a} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const maskable = (hide: boolean, text: string) => (hide ? "••••••" : text);

/** Height of the app's own top bar; the band hangs from its bottom. */
const BAR_PX = 64;
/** Scroll distance over which the name settles to the header's size. */
const FADE_PX = 120;
/** The body fades out, and the cap turns solid, before the body reaches it. */
const BODY_FADE_PX = 50;
const CAP_SOLID_PX = 36;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The band collapses into the header instead of being swapped for one. The
 * green slab is sticky with a negative `top`, so it scrolls up like any other
 * block until only the header's height is left, then stays. The name, chips
 * and menu live in a cap pinned where the band starts, so they never move;
 * the body (balance, bar, pills, actions) fades as it slides up under the
 * cap, and the name eases from a bigger size down to the header's. Scroll
 * writes straight to the elements: no re-render per frame.
 */
function useCollapsingBand(refs: {
  cap: React.RefObject<HTMLDivElement | null>;
  slab: React.RefObject<HTMLDivElement | null>;
  body: React.RefObject<HTMLDivElement | null>;
  name: React.RefObject<HTMLParagraphElement | null>;
  shadow: React.RefObject<HTMLDivElement | null>;
  capBg: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const { cap, slab, body, name, shadow, capBg } = refs;
    const capEl = cap.current;
    const slabEl = slab.current;
    if (!capEl || !slabEl) return;
    let raf = 0;
    let slabH = 0;
    let capH = 0;

    const layout = () => {
      const c = capEl.offsetHeight;
      // The body starts below the cap, which covers the slab's top.
      const pad = `${c + 8}px`;
      if (slabEl.style.paddingTop !== pad) slabEl.style.paddingTop = pad;
      const h = slabEl.offsetHeight;
      // Sticks when only the cap's height of the slab is left under the bar.
      const top = `${BAR_PX + c - h}px`;
      if (slabEl.style.top !== top) slabEl.style.top = top;
      capH = c;
      slabH = h;
    };
    const paint = () => {
      raf = 0;
      const y = window.scrollY;
      const f = clamp01(y / FADE_PX);
      if (body.current)
        body.current.style.opacity = String(1 - clamp01(y / BODY_FADE_PX));
      // Clear at rest, so the cap blends into the slab; solid once the body
      // has faded and the page starts to slide under it.
      if (capBg.current)
        capBg.current.style.opacity = String(clamp01(y / CAP_SOLID_PX));
      if (name.current) {
        name.current.style.transform = `scale(${1 + 0.3 * (1 - f)})`;
      }
      // The cap's shadow fades in once the slab has shrunk to the cap.
      if (shadow.current) {
        const stuckAt = Math.max(0, slabH - capH - 8);
        shadow.current.style.opacity = String(clamp01((y - stuckAt + 24) / 24));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    layout();
    paint();
    const ro = new ResizeObserver(() => {
      layout();
      paint();
    });
    ro.observe(capEl);
    ro.observe(slabEl);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [refs]);
}

/** The green band: name, then the remaining balance as the page's headline. */
function BalanceBand({
  hide,
  onToggleHide,
  actions = false,
  pb = "pb-20",
}: {
  hide: boolean;
  onToggleHide: () => void;
  actions?: boolean;
  pb?: string;
}) {
  const cap = useRef<HTMLDivElement>(null);
  const slab = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLParagraphElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const capBg = useRef<HTMLDivElement>(null);
  const [refs] = useState({ cap, slab, body, name, shadow, capBg });
  useCollapsingBand(refs);
  return (
    <>
      {/* Zero-height anchor: the cap inside is pinned under the top bar. */}
      <div className="sticky z-30 -mx-4 h-0" style={{ top: BAR_PX }}>
        <div
          ref={cap}
          className="absolute inset-x-0 top-0 px-4 pt-1 pb-2.5 text-white"
        >
          <div
            ref={capBg}
            aria-hidden="true"
            className="absolute inset-0 rounded-b-3xl bg-emerald-600 opacity-0
              dark:bg-emerald-950"
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <p
                ref={name}
                className="min-w-0 flex-1 origin-left truncate text-sm
                  font-black lowercase will-change-transform"
                style={{ transform: "scale(1.3)" }}
              >
                {B.name}
              </p>
              <Menu small />
            </div>
            <div className="mt-1">
              <CategoryChips />
            </div>
          </div>
          <div
            ref={shadow}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-full h-4
              bg-linear-to-b from-emerald-950/25 to-transparent opacity-0"
          />
        </div>
      </div>
      <div
        ref={slab}
        className="sticky z-0 -mx-4 px-4 pt-24 text-white"
        style={{ top: BAR_PX - 300 }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-b-3xl bg-linear-to-b
            from-emerald-600 to-emerald-500 dark:from-emerald-950
            dark:to-emerald-900"
        />
        <div ref={body} className={cn("relative", pb)}>
          <button
            type="button"
            onClick={onToggleHide}
            className="flex items-center gap-2 text-xs font-semibold opacity-80"
          >
            Remaining balance
            {hide ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <p className="text-4xl font-black tracking-tight tabular-nums">
            {maskable(hide, peso(B.remaining))}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${B.pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs font-semibold">
            <span>{maskable(hide, peso(B.collected))} collected</span>
            <span className="opacity-80">
              of {maskable(hide, peso(B.loaned))} loaned
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span
              className="rounded-full bg-white/20 px-2.5 py-1 text-[11px]
                font-bold"
            >
              next Nov 3 · ₱2,100
            </span>
            <span
              className="rounded-full bg-rose-500/90 px-2.5 py-1 text-[11px]
                font-bold"
            >
              2 overdue
            </span>
          </div>
          {actions && (
            <div className="mt-4 flex gap-5">
              {[
                [Plus, "New loan"],
                [StickyNote, "Note"],
                [Copy, "Copy amounts"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Plus;
                return (
                  <div
                    key={label as string}
                    className="flex flex-col items-center gap-1"
                  >
                    <span
                      className="flex size-11 items-center justify-center
                        rounded-full bg-white/20"
                    >
                      <I className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-semibold">
                      {label as string}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Profit trio and this month, as one card that floats over the band. */
function FigureCard({ hide }: { hide: boolean }) {
  return (
    <div className={card}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Profit due", B.profitExpected],
          ["Profit made", B.profitCollected],
          ["Per schedule", B.profitPerSchedule],
        ].map(([l, v]) => (
          <div key={l as string}>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {l}
            </p>
            <p
              className="text-sm font-bold text-card-foreground/80 tabular-nums"
            >
              {maskable(hide, peso(v as number))}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
        <div className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
          <p
            className="text-[11px] font-semibold text-amber-700
              dark:text-amber-400"
          >
            to pay this month
          </p>
          <p
            className="text-base font-black tabular-nums
              text-card-foreground/80"
          >
            {maskable(hide, peso(B.toPayMonth))}
          </p>
        </div>
        <div
          className="rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10"
        >
          <p
            className="text-[11px] font-semibold text-emerald-700
              dark:text-emerald-400"
          >
            paid this month
          </p>
          <p
            className="text-base font-black tabular-nums
              text-card-foreground/80"
          >
            {maskable(hide, peso(B.paidMonth))}
          </p>
        </div>
      </div>
    </div>
  );
}

/** One account as a list row: kind icon, principal, thin progress, what's left. */
function CompactRow({ a, hide }: { a: Acc; hide: boolean }) {
  const k = KIND[a.kind];
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          k.chip,
        )}
      >
        <k.icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-xl leading-tight font-black tracking-tight
            tabular-nums text-card-foreground/80"
        >
          {maskable(hide, peso(a.principal))}
        </p>
        <p className="truncate text-xs font-semibold text-muted-foreground">
          {a.meta}
        </p>
        {a.kind !== "pending" && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${a.paidPct}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="text-base font-bold tabular-nums text-card-foreground/80"
        >
          {maskable(hide, peso(a.left))}
        </span>
        {a.overdue ? (
          <span className="text-[11px] font-bold text-rose-500">
            {a.overdue} overdue
          </span>
        ) : a.kind === "pending" ? (
          <span className="text-[11px] font-bold text-amber-600">activate</span>
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">
            {a.next ? `next ${a.next.split(" · ")[0]}` : "manual"}
          </span>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </li>
  );
}

const KINDS: Kind[] = ["loan", "ca", "flat", "pending"];

/* ───────────── A · Balance, actions in band, one list ───────────── */
function A() {
  const [hide, setHide] = useState(false);
  return (
    <>
      <BalanceBand
        hide={hide}
        onToggleHide={() => setHide((h) => !h)}
        actions
        pb="pb-24"
      />
      <div className="relative z-10 -mt-12 space-y-5 px-1">
        <FigureCard hide={hide} />
        <div className={cn(card, "overflow-hidden p-0")}>
          {KINDS.map((k) => {
            const list = ACCOUNTS.filter((a) => a.kind === k);
            if (list.length === 0) return null;
            return (
              <div key={k}>
                <div
                  className={cn(
                    `flex items-center gap-2 px-4 py-1.5 text-xs font-bold
                    lowercase`,
                    KIND[k].chip,
                  )}
                >
                  {KIND[k].label}
                  <span className="opacity-70 tabular-nums">{list.length}</span>
                </div>
                <ul className="divide-y">
                  {list.map((a) => (
                    <CompactRow key={a.id} a={a} hide={hide} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <Notes />
        <Deleted />
      </div>
    </>
  );
}

/* ───────────── B · Balance, tabs, rich cards ───────────── */
function B_() {
  const [hide, setHide] = useState(false);
  const [tab, setTab] = useState<"accounts" | "notes" | "deleted">("accounts");
  return (
    <>
      <BalanceBand hide={hide} onToggleHide={() => setHide((h) => !h)} />
      <div className="relative z-10 -mt-10 space-y-5 px-1">
        <FigureCard hide={hide} />
        <div
          className="flex gap-1 rounded-2xl bg-emerald-50 p-1.5
            dark:bg-emerald-500/10"
        >
          {(["accounts", "notes", "deleted"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "flex-1 rounded-xl py-1.5 text-xs font-semibold capitalize",
                tab === k
                  ? "bg-card text-emerald-600 shadow-sm"
                  : "text-emerald-700/60 dark:text-emerald-300/60",
              )}
            >
              {k}
              <span className="ml-1 opacity-60">
                {k === "accounts" ? 4 : k === "notes" ? 2 : 1}
              </span>
            </button>
          ))}
        </div>
        {tab === "accounts" && <ClassicGroups />}
        {tab === "notes" && <Notes />}
        {tab === "deleted" && <Deleted />}
      </div>
    </>
  );
}

/* ───────────── C · Balance, attention first, folding groups ───────────── */
function C() {
  const [hide, setHide] = useState(false);
  const [folded, setFolded] = useState<Set<Kind>>(new Set(["flat"]));
  const toggle = (k: Kind) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const late = ACCOUNTS.filter((a) => a.overdue);
  return (
    <>
      <BalanceBand hide={hide} onToggleHide={() => setHide((h) => !h)} />
      <div className="relative z-10 -mt-10 space-y-5 px-1">
        <FigureCard hide={hide} />
        {late.length > 0 && (
          <div
            className="overflow-hidden rounded-2xl bg-rose-50 ring-1
              ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/20"
          >
            <div
              className="flex items-center gap-2 px-4 pt-3 text-xs font-bold
                text-rose-700 dark:text-rose-300"
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              needs attention
              <span className="ml-auto tabular-nums">
                {peso(late.reduce((n, a) => n + a.left, 0))}
              </span>
            </div>
            <ul>
              {late.map((a) => (
                <CompactRow key={a.id} a={a} hide={hide} />
              ))}
            </ul>
          </div>
        )}
        <div className={cn(card, "overflow-hidden p-0")}>
          {KINDS.map((k) => {
            const list = ACCOUNTS.filter((a) => a.kind === k);
            if (list.length === 0) return null;
            const isFolded = folded.has(k);
            const left = list.reduce((n, a) => n + a.left, 0);
            return (
              <div key={k} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(k)}
                  className={cn(
                    `flex w-full items-center gap-2 px-4 py-2.5 text-left
                    text-xs font-bold lowercase`,
                    KIND[k].chip,
                  )}
                >
                  {KIND[k].label}
                  <span className="opacity-70 tabular-nums">{list.length}</span>
                  <span className="ml-auto tabular-nums">
                    {maskable(hide, peso(left))}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      isFolded && "-rotate-90",
                    )}
                  />
                </button>
                {!isFolded && (
                  <ul className="divide-y">
                    {list.map((a) => (
                      <CompactRow key={a.id} a={a} hide={hide} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <Notes />
        <Deleted />
      </div>
    </>
  );
}

const VARIANTS = [
  { id: "A", name: "Actions + list", el: <A /> },
  { id: "B", name: "Tabs + cards", el: <B_ /> },
  { id: "C", name: "Attention first", el: <C /> },
];

export default function BorrowerMockup() {
  const [v, setV] = useState("A");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pinned above the bottom nav, portalled out of the page's transformed
  // wrapper so "fixed" really is the screen.
  const overlay = (
    <>
      <TopBar />
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
    </>
  );

  return (
    <div className="mx-auto max-w-md px-4 pb-40">
      {/* Hide the app's own top bar; the green one below stands in for it. */}
      <style>{`div.fixed.top-0.z-40:not([data-mock-bar]){display:none}`}</style>
      {mounted && createPortal(overlay, document.body)}
      {VARIANTS.find((x) => x.id === v)!.el}
    </div>
  );
}
