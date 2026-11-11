"use client";

// THROWAWAY PROTOTYPE: static data, three account-page directions in the
// borrower page's look (green band that folds into a fixed header, rows
// instead of boxed cards). Delete with the route.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, m, useMotionValue, useTransform } from "motion/react";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  CircleDollarSign,
  Eye,
  EyeOff,
  Link2,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HeaderSearch from "@/components/header-search";
import ThemeToggle from "@/components/theme-toggle";
import { CalendarTile } from "@/components/calendar-tile";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const maskable = (hide: boolean, text: string) => (hide ? "••••••" : text);

const A = {
  borrower: "teofil norm tabanao",
  kind: "loan",
  principal: 20000,
  terms: "10% · bimonthly · 4mo",
  released: "Aug 1",
  releasedAgo: "released 89 days ago",
  total: 28000,
  collected: 15500,
  left: 12500,
  pct: 55,
  profitExpected: 8000,
  categories: [
    { name: "teachers", color: "#a78bfa" },
    { name: "rolling", color: "#34d399" },
  ],
};

type State = "paid" | "partial" | "overdue" | "pending";

type Sched = {
  n: number;
  date: string;
  amount: number;
  state: State;
  /** Under the amount. */
  sub: string;
  paid?: number;
  next?: boolean;
};

const SCHEDULES: Sched[] = [
  { n: 1, date: "2026-08-15", amount: 3500, state: "paid", sub: "paid Aug 15" },
  {
    n: 2,
    date: "2026-08-30",
    amount: 3500,
    state: "paid",
    sub: "paid Aug 29 · 1 day early",
  },
  { n: 3, date: "2026-09-15", amount: 3500, state: "paid", sub: "paid Sep 15" },
  {
    n: 4,
    date: "2026-09-30",
    amount: 3500,
    state: "paid",
    sub: "paid Oct 2 · 2 days late",
  },
  {
    n: 5,
    date: "2026-10-15",
    amount: 3500,
    state: "overdue",
    paid: 1500,
    sub: "₱1,500 paid · 14 days overdue",
  },
  {
    n: 6,
    date: "2026-10-30",
    amount: 3500,
    state: "pending",
    next: true,
    sub: "due tomorrow",
  },
  {
    n: 7,
    date: "2026-11-15",
    amount: 3500,
    state: "pending",
    sub: "due in 17 days",
  },
  {
    n: 8,
    date: "2026-11-30",
    amount: 3500,
    state: "pending",
    sub: "due in 32 days",
  },
];

const TILE: Record<State, { tile: string; band: string }> = {
  paid: {
    tile: "border-emerald-200 dark:border-emerald-900/50",
    band: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  },
  partial: {
    tile: "border-violet-200 dark:border-violet-900/50",
    band: "bg-violet-200 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100",
  },
  overdue: {
    tile: "border-rose-200 dark:border-rose-900/50",
    band: "bg-rose-200 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100",
  },
  pending: {
    tile: "border-yellow-200 dark:border-yellow-900/50",
    band: "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100",
  },
};

const SUB_TONE: Record<State, string> = {
  paid: "text-emerald-700 dark:text-emerald-300",
  partial: "text-violet-600 dark:text-violet-300",
  overdue: "text-rose-600 dark:text-rose-300",
  pending: "text-muted-foreground",
};

const card =
  "rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10";

/** The persistent green top bar the real page keeps (see MobileTopBar). */
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

/** The menu: share the schedule and copy the public link live in here now. */
function Menu({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Account menu"
        className="flex size-8 items-center justify-center rounded-full
          bg-white/20 text-white"
      >
        <MoreVertical className="size-5" />
      </button>
      {open && (
        <div
          className="absolute top-10 right-0 z-50 w-48 overflow-hidden
            rounded-2xl bg-card py-1 text-sm font-semibold text-card-foreground
            shadow-xl ring-1 ring-black/10"
        >
          {[
            [Pencil, "Edit account"],
            [Share2, "Share schedule"],
            [Link2, "Copy public link"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Pencil;
            return (
              <div
                key={label as string}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <I className="size-4 text-muted-foreground" />
                {label as string}
              </div>
            );
          })}
          <div className="flex items-center gap-3 px-4 py-2.5 text-rose-600">
            <Trash2 className="size-4" />
            Delete account
          </div>
        </div>
      )}
    </div>
  );
}

const BAR_PX = 64;
const FADE_PX = 120;
const BODY_FADE_PX = 50;
const CAP_SOLID_PX = 36;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Same fold as the borrower page: a sticky slab with a negative `top` scrolls
 * up at the page's speed until only the cap is left; the body fades under
 * the cap, and the cap's line swaps from the terms to the figures.
 */
function useFold(refs: {
  cap: React.RefObject<HTMLDivElement | null>;
  slab: React.RefObject<HTMLDivElement | null>;
  body: React.RefObject<HTMLDivElement | null>;
  name: React.RefObject<HTMLParagraphElement | null>;
  capBg: React.RefObject<HTMLDivElement | null>;
  idle: React.RefObject<HTMLDivElement | null>;
  stats: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const { cap, slab, body, name, capBg, idle, stats } = refs;
    const capEl = cap.current;
    const slabEl = slab.current;
    if (!capEl || !slabEl) return;
    let raf = 0;
    const layout = () => {
      const c = capEl.offsetHeight;
      const pad = `${c + 8}px`;
      if (slabEl.style.paddingTop !== pad) slabEl.style.paddingTop = pad;
      const top = `${BAR_PX + c - slabEl.offsetHeight}px`;
      if (slabEl.style.top !== top) slabEl.style.top = top;
    };
    const paint = () => {
      raf = 0;
      const y = window.scrollY;
      const f = clamp01(y / FADE_PX);
      if (body.current)
        body.current.style.opacity = String(1 - clamp01(y / BODY_FADE_PX));
      if (capBg.current)
        capBg.current.style.opacity = String(clamp01(y / CAP_SOLID_PX));
      if (name.current)
        name.current.style.transform = `scale(${1 + 0.3 * (1 - f)})`;
      if (idle.current) idle.current.style.opacity = String(1 - f);
      if (stats.current) stats.current.style.opacity = String(f);
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

function CapChips() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px]
          font-semibold"
      >
        {A.kind} · {peso(A.principal)}
      </span>
      {A.categories.map((c) => (
        <span
          key={c.name}
          className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5
            py-0.5 text-[11px] font-semibold"
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

/**
 * The band. `children` is the body that fades as the page scrolls; the cap
 * (borrower, kind, menu) stays pinned under the top bar and, once folded,
 * shows what's left and what's collected.
 */
function Band({
  hide,
  children,
  pb = "pb-20",
}: {
  hide: boolean;
  children: React.ReactNode;
  pb?: string;
}) {
  const cap = useRef<HTMLDivElement>(null);
  const slab = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLParagraphElement>(null);
  const capBg = useRef<HTMLDivElement>(null);
  const idle = useRef<HTMLDivElement>(null);
  const stats = useRef<HTMLDivElement>(null);
  const [refs] = useState({ cap, slab, body, name, capBg, idle, stats });
  const [menu, setMenu] = useState(false);
  useFold(refs);
  return (
    <>
      <div className="sticky z-30 -mx-4 h-0" style={{ top: BAR_PX }}>
        <div
          ref={cap}
          className="absolute inset-x-0 top-0 px-4 pt-1 pb-2.5 text-white"
        >
          <div
            ref={capBg}
            aria-hidden="true"
            className="absolute inset-0 rounded-b-3xl bg-emerald-600 opacity-0
              shadow-[0_8px_14px_-6px_rgba(2,44,34,0.35)] dark:bg-emerald-950"
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <p
                ref={name}
                className="min-w-0 flex-1 origin-left truncate text-sm
                  font-black lowercase will-change-transform"
                style={{ transform: "scale(1.3)" }}
              >
                {A.borrower}
              </p>
              <Menu open={menu} onToggle={() => setMenu((v) => !v)} />
            </div>
            <div className="relative mt-1 h-[22px]">
              <div ref={idle} className="absolute inset-0">
                <CapChips />
              </div>
              <div
                ref={stats}
                className="absolute inset-0 flex items-center gap-4 text-[11px]
                  font-bold opacity-0"
              >
                <span>
                  <span className="opacity-70">left </span>
                  {maskable(hide, peso(A.left))}
                </span>
                <span>
                  <span className="opacity-70">collected </span>
                  {maskable(hide, peso(A.collected))}
                </span>
                <span className="ml-auto tabular-nums">{A.pct}%</span>
              </div>
            </div>
          </div>
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
          {children}
        </div>
      </div>
    </>
  );
}

function EyeButton({
  hide,
  onToggle,
  label,
}: {
  hide: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 text-xs font-semibold opacity-80"
    >
      {label}
      {hide ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

/** A row that slides left to show Paid and Delete, like the borrower list. */
function SwipeRow({
  children,
  tone = "bg-card",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  const W = 112;
  const x = useMotionValue(0);
  const o = useTransform(x, [-W, -16, 0], [1, 0, 0]);
  const open = useRef(false);
  const snap = (v: boolean) => {
    open.current = v;
    void animate(x, v ? -W : 0, {
      type: "spring",
      stiffness: 500,
      damping: 40,
    });
  };
  return (
    <li className="relative overflow-hidden">
      <m.div
        style={{ opacity: o }}
        className="absolute inset-y-0 right-0 flex w-28"
      >
        <span
          className="flex flex-1 flex-col items-center justify-center gap-0.5
            bg-emerald-600 text-[10px] font-bold text-white"
        >
          <Check className="size-4" strokeWidth={3} />
          Paid
        </span>
        <span
          className="flex flex-1 flex-col items-center justify-center gap-0.5
            bg-rose-600 text-[10px] font-bold text-white"
        >
          <Trash2 className="size-4" />
          Delete
        </span>
      </m.div>
      <m.div
        drag="x"
        dragConstraints={{ left: -W, right: 0 }}
        dragElastic={{ left: 0.1, right: 0 }}
        dragMomentum={false}
        style={{ x, touchAction: "pan-y" }}
        onDragEnd={(_, info) =>
          snap(info.offset.x < -W / 2 || info.velocity.x < -400)
        }
        className={cn("relative", tone)}
      >
        {children}
      </m.div>
    </li>
  );
}

function SchedRow({
  s,
  hide,
  compact = false,
}: {
  s: Sched;
  hide: boolean;
  compact?: boolean;
}) {
  const t = TILE[s.state];
  const left = s.paid ? s.amount - s.paid : s.amount;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CalendarTile
        date={s.date}
        size={compact ? "sm" : "md"}
        className={t.tile}
        bandClassName={t.band}
      />
      <div className="min-w-0 flex-1">
        <p
          className="flex items-center gap-2 text-[19px] leading-tight
            font-black tracking-tight text-card-foreground/70 tabular-nums"
        >
          {maskable(hide, peso(s.amount))}
          {s.next && (
            <span
              className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px]
                font-black tracking-wide text-sky-800 uppercase
                dark:bg-sky-900/50 dark:text-sky-200"
            >
              next
            </span>
          )}
        </p>
        <p className={cn("text-[11px] font-semibold", SUB_TONE[s.state])}>
          {s.n} of 8 · {s.sub}
        </p>
        {s.paid ? (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-violet-300"
              style={{ width: `${(s.paid / s.amount) * 100}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {s.state === "paid" ? (
          <span
            className="flex size-6 items-center justify-center rounded-full
              bg-emerald-500 text-white"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : (
          <span
            className="text-[15px] font-extrabold text-card-foreground/70
              tabular-nums"
          >
            {maskable(hide, peso(left))}
            <span className="ml-1 text-[10px] font-semibold opacity-60">
              left
            </span>
          </span>
        )}
        {s.state === "overdue" && (
          <span className="text-[11px] font-bold text-rose-500">overdue</span>
        )}
      </div>
    </div>
  );
}

function GroupLabel({
  label,
  right,
  tone,
  onClick,
  folded,
}: {
  label: string;
  right?: string;
  tone: string;
  onClick?: () => void;
  folded?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        `flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-bold
        lowercase`,
        tone,
      )}
    >
      {label}
      {right && <span className="ml-auto tabular-nums">{right}</span>}
      {onClick && (
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            !right && "ml-auto",
            folded && "-rotate-90",
          )}
        />
      )}
    </Tag>
  );
}

const GROUP_TONE = {
  overdue: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  upcoming:
    "bg-yellow-50 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-200",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

/** Overdue / upcoming / paid as grouped, swipeable rows in one card. */
function GroupedSchedules({
  hide,
  foldPaid = true,
}: {
  hide: boolean;
  foldPaid?: boolean;
}) {
  const [paidFolded, setPaidFolded] = useState(foldPaid);
  const overdue = SCHEDULES.filter((s) => s.state === "overdue");
  const upcoming = SCHEDULES.filter((s) => s.state === "pending");
  const paid = SCHEDULES.filter((s) => s.state === "paid");
  return (
    <div className={cn(card, "overflow-hidden")}>
      <GroupLabel
        label="overdue"
        right={peso(2000)}
        tone={GROUP_TONE.overdue}
      />
      <ul className="divide-y">
        {overdue.map((s) => (
          <SwipeRow key={s.n}>
            <SchedRow s={s} hide={hide} />
          </SwipeRow>
        ))}
      </ul>
      <GroupLabel
        label="upcoming"
        right={peso(10500)}
        tone={GROUP_TONE.upcoming}
      />
      <ul className="divide-y">
        {upcoming.map((s) => (
          <SwipeRow key={s.n}>
            <SchedRow s={s} hide={hide} />
          </SwipeRow>
        ))}
      </ul>
      <GroupLabel
        label={`paid · ${paid.length}`}
        right={peso(14000)}
        tone={GROUP_TONE.paid}
        onClick={() => setPaidFolded((v) => !v)}
        folded={paidFolded}
      />
      {!paidFolded && (
        <ul className="divide-y">
          {paid.map((s) => (
            <SwipeRow key={s.n}>
              <SchedRow s={s} hide={hide} />
            </SwipeRow>
          ))}
        </ul>
      )}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 text-center text-[11px] text-muted-foreground">
      {children}
    </p>
  );
}

/* ───────── A · Balance band + grouped rows ───────── */
function VariantA() {
  const [hide, setHide] = useState(false);
  return (
    <>
      <Band hide={hide}>
        <EyeButton
          hide={hide}
          onToggle={() => setHide((h) => !h)}
          label="Left to collect"
        />
        <p className="text-4xl font-black tracking-tight tabular-nums">
          {maskable(hide, peso(A.left))}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${A.pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs font-semibold">
          <span>{maskable(hide, peso(A.collected))} collected</span>
          <span className="opacity-80">
            of {maskable(hide, peso(A.total))} total
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            A.terms,
            `${A.releasedAgo}`,
            `profit ${maskable(hide, peso(A.profitExpected))}`,
          ].map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/20 px-2.5 py-1 text-[11px]
                font-bold"
            >
              {t}
            </span>
          ))}
          <span
            className="rounded-full bg-rose-500/90 px-2.5 py-1 text-[11px]
              font-bold"
          >
            1 overdue
          </span>
        </div>
      </Band>
      <div className="relative z-10 -mt-10 space-y-4 px-1">
        <GroupedSchedules hide={hide} />
        <Hint>
          swipe a row for Paid or Delete · long-press to select several
        </Hint>
      </div>
    </>
  );
}

/* ───────── B · Ring + terms, timeline with an open next payment ───────── */
function VariantB() {
  const [hide, setHide] = useState(false);
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <>
      <Band hide={hide} pb="pb-24">
        <div className="flex items-center gap-4">
          <div className="relative size-[84px] shrink-0">
            <svg viewBox="0 0 84 84" className="-rotate-90">
              <circle
                cx="42"
                cy="42"
                r={R}
                strokeWidth="8"
                className="fill-none stroke-white/25"
              />
              <circle
                cx="42"
                cy="42"
                r={R}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (A.pct / 100) * C}
                className="fill-none stroke-white"
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center
                text-lg font-black"
            >
              {A.pct}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <EyeButton
              hide={hide}
              onToggle={() => setHide((h) => !h)}
              label="Principal"
            />
            <p className="text-3xl font-black tracking-tight tabular-nums">
              {maskable(hide, peso(A.principal))}
            </p>
            <p className="text-xs font-semibold opacity-80">{A.terms}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["left", peso(A.left)],
            ["collected", peso(A.collected)],
            ["profit", peso(A.profitExpected)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/15 px-2 py-2">
              <p className="text-[11px] font-semibold opacity-80">{k}</p>
              <p className="text-sm font-black tabular-nums">
                {maskable(hide, v)}
              </p>
            </div>
          ))}
        </div>
      </Band>
      <div className="relative z-10 -mt-12 space-y-4 px-1">
        <div className={cn(card, "p-4")}>
          <p className="text-xs font-bold text-muted-foreground lowercase">
            payment schedule · 8 installments
          </p>
          <ol className="mt-3">
            {SCHEDULES.map((s, i) => {
              const dot = {
                paid: "border-emerald-500 bg-emerald-500 text-white",
                partial: "border-violet-400 bg-violet-100",
                overdue: "border-rose-400 bg-rose-100",
                pending: s.next
                  ? "border-yellow-400 bg-yellow-100"
                  : "border-slate-300 bg-card dark:border-slate-600",
              }[s.state];
              return (
                <li key={s.n} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < SCHEDULES.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-6 bottom-0 left-[11px] w-0.5",
                        s.state === "paid"
                          ? "bg-emerald-300"
                          : "bg-slate-200 dark:bg-white/10",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      `relative z-10 flex size-6 shrink-0 items-center
                      justify-center rounded-full border-2`,
                      dot,
                    )}
                  >
                    {s.state === "paid" && (
                      <Check className="size-3.5" strokeWidth={3} />
                    )}
                  </span>
                  <div
                    className={cn(
                      "min-w-0 flex-1",
                      s.next &&
                        `-mt-1 rounded-2xl bg-yellow-50 p-3 ring-1
                        ring-yellow-200 dark:bg-yellow-500/10
                        dark:ring-yellow-500/30`,
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "text-base font-black tabular-nums",
                          s.state === "paid"
                            ? "text-muted-foreground"
                            : "text-card-foreground/80",
                        )}
                      >
                        {maskable(hide, peso(s.amount))}
                      </span>
                      <span
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        {new Date(s.date + "T00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                      <span
                        className={cn(
                          "ml-auto text-[11px] font-bold",
                          SUB_TONE[s.state],
                        )}
                      >
                        {s.state === "overdue"
                          ? "overdue"
                          : s.state === "paid"
                            ? "paid"
                            : s.next
                              ? "next"
                              : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                    {(s.next || s.state === "overdue") && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-xl bg-emerald-600 py-2
                            text-xs font-bold text-white"
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-xl bg-muted py-2 text-xs
                            font-bold text-foreground/70"
                        >
                          Partial…
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <Hint>the open item is always the one that needs you</Hint>
      </div>
    </>
  );
}

/* ───────── C · Next payment first, details tucked away ───────── */
function VariantC() {
  const [hide, setHide] = useState(false);
  const [details, setDetails] = useState(false);
  const next = SCHEDULES.find((s) => s.next)!;
  const late = SCHEDULES.find((s) => s.state === "overdue")!;
  return (
    <>
      <Band hide={hide} pb="pb-28">
        <EyeButton
          hide={hide}
          onToggle={() => setHide((h) => !h)}
          label="Left to collect"
        />
        <p className="text-4xl font-black tracking-tight tabular-nums">
          {maskable(hide, peso(A.left))}
        </p>
        <p className="mt-0.5 text-xs font-semibold opacity-80">
          {maskable(hide, peso(A.collected))} of {maskable(hide, peso(A.total))}{" "}
          · {A.pct}% collected
        </p>
      </Band>
      <div className="relative z-10 -mt-20 space-y-4 px-1">
        <div className={cn(card, "overflow-hidden")}>
          <div className="flex items-center gap-3 px-4 pt-4">
            <CalendarTile
              date={late.date}
              className={TILE.overdue.tile}
              bandClassName={TILE.overdue.band}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-rose-600">
                overdue · 14 days
              </p>
              <p
                className="text-xl font-black text-card-foreground/70
                  tabular-nums"
              >
                {maskable(hide, peso(late.amount - (late.paid ?? 0)))}
                <span className="ml-1.5 text-xs font-semibold opacity-60">
                  left of {peso(late.amount)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 px-4 pt-3 pb-4">
            <button
              type="button"
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm
                font-bold text-white"
            >
              Mark paid
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-bold
                text-foreground/70"
            >
              Partial…
            </button>
          </div>
          <div className="border-t" />
          <div className="flex items-center gap-3 px-4 py-3">
            <CalendarTile
              date={next.date}
              size="sm"
              className={TILE.pending.tile}
              bandClassName={TILE.pending.band}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-sky-700">
                next · tomorrow
              </p>
              <p
                className="text-base font-black text-card-foreground/70
                  tabular-nums"
              >
                {maskable(hide, peso(next.amount))}
              </p>
            </div>
            <CircleDollarSign className="size-5 text-muted-foreground" />
          </div>
        </div>

        <div className={cn(card, "overflow-hidden")}>
          <button
            type="button"
            onClick={() => setDetails((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <span className="text-sm font-bold text-card-foreground/80">
              {A.kind} · {peso(A.principal)}
            </span>
            <span className="text-xs text-muted-foreground">{A.terms}</span>
            <ChevronDown
              className={cn(
                "ml-auto size-4 text-muted-foreground transition-transform",
                details && "rotate-180",
              )}
            />
          </button>
          {details && (
            <dl
              className="grid grid-cols-2 gap-x-4 gap-y-2 border-t px-4 py-3
                text-xs"
            >
              {[
                ["released", `${A.released} · ${A.releasedAgo}`],
                ["interest", "10% per month"],
                ["total due", peso(A.total)],
                ["profit expected", peso(A.profitExpected)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-bold text-card-foreground/80 tabular-nums">
                    {maskable(hide && k !== "released", v)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <GroupedSchedules hide={hide} />
        <Hint>what needs you is at the top; the full schedule is below</Hint>
      </div>
    </>
  );
}

const VARIANTS = [
  { id: "A", name: "Balance + groups", el: <VariantA /> },
  { id: "B", name: "Ring + timeline", el: <VariantB /> },
  { id: "C", name: "Next payment first", el: <VariantC /> },
];

export default function AccountMockup() {
  const [v, setV] = useState("A");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
      {/* Hide the app's own top bar; the green one above stands in for it. */}
      <style>{`div.fixed.top-0.z-40:not([data-mock-bar]){display:none}`}</style>
      {mounted && createPortal(overlay, document.body)}
      {VARIANTS.find((x) => x.id === v)!.el}
    </div>
  );
}
