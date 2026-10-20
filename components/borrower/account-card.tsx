import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { memo, useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatDate } from "@/lib/utils";
import AccountCardMenu from "./account-card-menu";
import {
  AccountRow,
  AccountComputedMetrics,
} from "./borrower-accounts-section";
import type { InstallmentDot } from "@/lib/payment-schedule/installment-dots";
import { accountTone, TILE_TONES, TONES } from "@/lib/account-tones";
import { CalendarTile } from "@/components/calendar-tile";
import { todayDateValue } from "@/lib/checklist/dates";

/** iOS-style ease: quick off the mark, long soft landing. */
const EXPAND_EASE = [0.32, 0.72, 0, 1] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `YYYY-MM-DD` split without going through `Date`, so no timezone shifts. */
function ymd(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m: m - 1, d };
}

function shortDate(iso: string) {
  const { m, d } = ymd(iso);
  return `${MONTHS[m]} ${d}`;
}

/** Amounts to at most 2 decimals (profit is divided, so it can be 379.997). */
const fmt = (n: number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

function fmtTimeAgo(days: number) {
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof TILE_TONES;
}) {
  const t = TILE_TONES[tone];
  return (
    <div className={`min-w-0 rounded-xl border px-2.5 py-1.5 ${t.box}`}>
      <p className={`truncate text-[10px] font-semibold ${t.label}`}>{label}</p>
      <p
        className={`truncate text-sm font-black tracking-tight tabular-nums
          ${t.value}`}
      >
        ₱{value}
      </p>
    </div>
  );
}

/** Installments are shown in fixed pages of this many dots. */
const MAX_DOTS = 6;

function dotClasses(state: InstallmentDot["state"], isNext: boolean) {
  if (state === "paid") return "border-2 border-emerald-500 bg-emerald-500";
  if (state === "partial")
    return "border-2 border-[#b9a8d8] bg-[#ece5f7] dark:border-[#6b5a8c] dark:bg-[#322a44]";
  if (state === "overdue")
    return "border-2 border-rose-400 bg-rose-100 dark:border-rose-500 dark:bg-rose-900/40";
  if (isNext)
    return "border-2 border-yellow-400 bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-900/30";
  return "border-2 border-slate-300 dark:border-slate-600";
}

/**
 * The page of installments holding the first one not yet fully paid, so with
 * 13 of 20 paid it is 13-18 (the last paid one stays in view). Once every
 * installment on a page is paid it flips to the next page.
 */
function dotWindow(installments: InstallmentDot[]) {
  const first = installments.findIndex((i) => i.state !== "paid");
  if (first < 0) return { shown: [] as InstallmentDot[], start: 0 };
  const start = Math.floor(first / MAX_DOTS) * MAX_DOTS;
  return { shown: installments.slice(start, start + MAX_DOTS), start };
}

/** One dot per installment on the current page: paid, partial, overdue, next, later. */
function ScheduleDots({
  installments,
  nextDate,
}: {
  installments: InstallmentDot[];
  nextDate: string | null;
}) {
  const { shown, start } = dotWindow(installments);
  const paid = installments.filter((i) => i.state === "paid").length;

  if (shown.length === 0) {
    return (
      <div
        className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold
          text-emerald-700 dark:text-emerald-300"
      >
        <Check className="size-3.5" strokeWidth={3} />
        all installments paid
      </div>
    );
  }

  const nextIndex = (() => {
    const exact = shown.findIndex(
      (i) => i.state === "pending" && nextDate && i.due_date === nextDate,
    );
    return exact >= 0 ? exact : shown.findIndex((i) => i.state === "pending");
  })();
  const title = (i: InstallmentDot) =>
    `${formatDate(i.due_date)} · ${
      i.state === "partial"
        ? `₱${fmt(i.amount_paid)} of ₱${fmt(i.amount_due)} paid`
        : `${i.state} · ₱${fmt(i.amount_due)}`
    }`;

  return (
    <div
      role="img"
      aria-label={`${paid} of ${installments.length} installments paid; showing ${start + 1} to ${start + shown.length}`}
      className="mt-2 grid gap-1"
      style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
    >
      {shown.map((i, idx) => (
        <div key={i.due_date + idx} title={title(i)} className="text-center">
          <div
            className={`mx-auto flex size-[26px] items-center justify-center
            rounded-full ${dotClasses(i.state, idx === nextIndex)}`}
          >
            {i.state === "paid" && (
              <Check className="size-3.5 text-white" strokeWidth={3} />
            )}
          </div>
          <p
            className={`mt-1 text-[10px] tabular-nums ${
              idx === nextIndex
                ? "font-bold text-slate-700 dark:text-slate-200"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {shortDate(i.due_date)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Paid and part-paid shares of the contract, for the progress bar. */
function ProgressBar({
  paidPct,
  partialPct,
  className = "h-2",
}: {
  paidPct: number;
  partialPct: number;
  className?: string;
}) {
  return (
    <div
      className={`flex overflow-hidden rounded-full bg-slate-100
        dark:bg-slate-800 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(paidPct + partialPct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-emerald-400 transition-all duration-500"
        style={{ width: `${paidPct}%` }}
      />
      <div
        className="h-full bg-[#cbbbe6] transition-all duration-500
          dark:bg-[#5a4a78]"
        style={{ width: `${partialPct}%` }}
      />
    </div>
  );
}

export const AccountCard = memo(function AccountCard({
  account,
  isOpening,
  onOpen,
  onPrefetch,
  onEdit,
  onActivate,
  metrics,
  selectionMode,
  selected,
  onToggleSelect,
  expanded = true,
  onToggleExpand,
  animateToggle = true,
}: {
  account: AccountRow;
  isOpening: boolean;
  onOpen: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onEdit: (account: AccountRow) => void;
  onActivate?: (account: AccountRow) => void;
  metrics?: AccountComputedMetrics;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** A compact row when false; the full card when true. */
  expanded?: boolean;
  onToggleExpand?: (id: string) => void;
  /** False swaps compact and full instantly, e.g. when restoring open cards. */
  animateToggle?: boolean;
}) {
  const amountLeftToPay = metrics?.amountLeftToPay ?? 0;
  const daysSinceRelease = metrics?.daysSinceRelease ?? 0;
  const profitPerSchedule = metrics?.profitPerSchedule ?? 0;
  const totalDue = metrics?.totalDue ?? 0;
  const totalPaid = metrics?.totalPaid ?? 0;
  const overdueCount = metrics?.overdueCount ?? 0;
  const overdueTotal = metrics?.overdueTotal ?? 0;
  const [overdueExpanded, setOverdueExpanded] = useState(overdueCount <= 6);
  // Must be declared up here: the Partials block below returns early when
  // there are none, so a hook inside it changes the hook count between renders.
  const [partialsExpanded, setPartialsExpanded] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  // Compact row and full card share one easing and duration, so the height
  // hand-off between them is a straight blend rather than a jump.
  const collapseMotion =
    reduceMotion || !animateToggle
      ? {}
      : {
          initial: { height: 0, opacity: 0 },
          animate: {
            height: "auto",
            opacity: 1,
            transition: {
              height: { duration: 0.4, ease: EXPAND_EASE },
              opacity: { duration: 0.28, delay: 0.08 },
            },
          },
          exit: {
            height: 0,
            opacity: 0,
            transition: {
              height: { duration: 0.4, ease: EXPAND_EASE },
              opacity: { duration: 0.16 },
            },
          },
        };
  const isManual = account.schedule_mode === "manual";
  const isRolling = isManual && account.interest_type === "rolling";
  const isPending = account.status === "pending";
  const isCashAdvance = account.type === "cash_advance";
  const hasOverdue = overdueCount > 0;
  const termMonths = Number(metrics?.term_months) || 1;

  const installments = metrics?.installments ?? [];
  const useDots = !isManual && !isPending && installments.length > 0;
  const paidInstallments = installments.filter(
    (i) => i.state === "paid",
  ).length;
  const dotPage = dotWindow(installments);
  const partialPaid = installments
    .filter((i) => i.state === "partial")
    .reduce((sum, i) => sum + i.amount_paid, 0);
  const pct = (n: number) =>
    totalDue > 0 ? Math.min(100, (n / totalDue) * 100) : 0;
  const partialPct = Math.min(pct(partialPaid), pct(totalPaid));
  const paidPct = Math.max(0, pct(totalPaid) - partialPct);
  const progressPct = Math.round(pct(totalPaid));

  const showCollections = !isPending && (!isManual || isRolling);
  const nextPending =
    metrics?.nextCollections?.find((nc) => nc.status === "pending") ?? null;
  const partials =
    metrics?.nextCollections?.filter((nc) => nc.status === "partial") ?? [];
  const hasFooter =
    (showCollections && (nextPending || partials.length > 0)) || hasOverdue;

  const metaText = isPending
    ? "pending"
    : [
        account.interest_rate != null ? `${account.interest_rate}%` : null,
        isManual ? "manual" : account.payment_frequency,
        isManual ? null : `${termMonths}mo`,
      ]
        .filter(Boolean)
        .join(" · ");
  const releaseYmd = account.release_date?.slice(0, 10) ?? null;
  const release = releaseYmd ? ymd(releaseYmd) : null;
  const tone = accountTone({ isManual, isRolling, isCashAdvance });
  const releasedAgo =
    daysSinceRelease > 0 ? fmtTimeAgo(daysSinceRelease) : "today";
  // The tile only shows month and day, so a release from another year says
  // the year in the text beside it.
  const releasedYear =
    release && release.y !== Number(todayDateValue().slice(0, 4))
      ? release.y
      : null;

  function handleMainClick() {
    if (isOpening) return;
    if (selectionMode) {
      onToggleSelect?.(account.id);
      return;
    }
    // A compact row expands in place; the full card opens the account.
    if (!expanded && onToggleExpand) {
      onToggleExpand(account.id);
      return;
    }
    onOpen(account.id);
  }

  function handlePointerDown() {
    if (selectionMode) return;
    longPressTimer.current = setTimeout(() => {
      onToggleSelect?.(account.id);
    }, 500);
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const statusDot = account.pendingSync
    ? "bg-sky-400"
    : account.status === "active"
      ? "bg-emerald-500"
      : account.status === "pending"
        ? "bg-amber-400"
        : "bg-slate-400";
  const statusText = account.pendingSync
    ? "text-sky-700 dark:text-sky-300"
    : account.status === "active"
      ? "text-emerald-700 dark:text-emerald-300"
      : account.status === "pending"
        ? "text-amber-700 dark:text-amber-300"
        : "text-slate-500 dark:text-slate-400";

  // The button is 40px for a thumb; the box inside is what you see.
  const selectionBox = (
    <button
      type="button"
      onClick={() => onToggleSelect?.(account.id)}
      className="relative z-10 flex size-10 items-center justify-center"
      aria-label={selected ? "Deselect account" : "Select account"}
      aria-pressed={!!selected}
    >
      <span
        className={`flex size-5 items-center justify-center rounded border
          transition-colors ${
            selected
              ? `border-slate-900 bg-slate-900 dark:border-border
                dark:bg-amber-400`
              : "border-slate-300 bg-white dark:border-border dark:bg-card"
          }`}
      >
        {selected && (
          <svg
            className="size-3 text-white dark:text-slate-600"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M2 7L5.5 10.5L12 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-slate-200
        bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]
        transition-[transform,opacity] duration-200 active:scale-[0.985]
        motion-reduce:transition-none dark:border-border dark:bg-card
        ${isOpening ? "scale-[0.98] opacity-60" : ""}
        ${selectionMode && selected ? "ring ring-blue-600 dark:ring-amber-400" : ""}`}
    >
      <AnimatePresence initial={false}>
        {!expanded ? (
          <motion.div
            key="compact"
            {...collapseMotion}
            className="overflow-hidden"
          >
            {/* Compact row */}
            <div className="flex items-center gap-2.5 px-3 py-2">
              {release && releaseYmd && (
                <CalendarTile
                  date={releaseYmd}
                  size="sm"
                  className="self-start border-slate-200 dark:border-border"
                  bandClassName="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                  title={`Released ${formatDate(releaseYmd)}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="truncate text-base font-black tracking-tight
                        text-slate-700 tabular-nums dark:text-foreground"
                    >
                      ₱{fmt(Number(account.principal_amount ?? 0))}
                    </span>
                    {isPending && (
                      <span
                        className="text-[11px] font-bold text-amber-700
                          dark:text-amber-300"
                      >
                        pending
                      </span>
                    )}
                    {account.pendingSync && (
                      <span
                        className="rounded-full bg-sky-100 px-2 py-0.5
                          text-[10px] font-bold text-sky-700 dark:bg-sky-900/40
                          dark:text-sky-200"
                      >
                        syncing
                      </span>
                    )}
                  </div>
                  {!isPending && !account.pendingSync && (
                    <p className="flex shrink-0 items-center gap-1.5 text-sm">
                      <span
                        className="rounded-md bg-yellow-100 px-1.5 py-0.5
                          font-black tracking-tight text-slate-600 tabular-nums
                          dark:bg-yellow-900/30 dark:text-yellow-100"
                      >
                        ₱{fmt(amountLeftToPay)}
                      </span>
                      <span
                        className="font-medium text-slate-500
                          dark:text-slate-400"
                      >
                        left
                      </span>
                    </p>
                  )}
                </div>
                {!isPending && totalDue > 0 && (
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar
                      paidPct={paidPct}
                      partialPct={partialPct}
                      className="h-1.5 flex-1"
                    />
                    <span
                      className="w-8 text-right text-[11px] font-bold
                        text-slate-500 tabular-nums dark:text-slate-400"
                    >
                      {progressPct}%
                    </span>
                  </div>
                )}
                {(release || (!isPending && (hasOverdue || nextPending))) && (
                  <div
                    className="mt-1 flex items-center justify-between gap-3
                      text-[11px] text-slate-500 dark:text-slate-400"
                  >
                    <span className="truncate">
                      {release &&
                        `released ${
                          releasedYear ? `${releasedYear} · ` : ""
                        }${releasedAgo}`}
                    </span>
                    {!isPending &&
                      (hasOverdue ? (
                        <span
                          className="shrink-0 font-bold text-rose-600
                            dark:text-rose-300"
                        >
                          {overdueCount} overdue
                        </span>
                      ) : nextPending ? (
                        <span
                          className="shrink-0 text-xs font-bold text-slate-700
                            tabular-nums dark:text-slate-100"
                        >
                          <span
                            className="font-medium text-slate-500
                              dark:text-slate-400"
                          >
                            next
                          </span>{" "}
                          {shortDate(nextPending.due_date)} · ₱
                          {fmt(nextPending.amount)}
                        </span>
                      ) : null)}
                  </div>
                )}
              </div>
              {selectionMode ? (
                <div className="-mr-2.5 shrink-0">{selectionBox}</div>
              ) : (
                <ChevronDown
                  className="size-4 shrink-0 text-slate-400"
                  aria-hidden
                />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            {...collapseMotion}
            className="overflow-hidden"
          >
            <div className="px-4 py-3">
              {/* Header band: type, principal and release date */}
              <div className={`-mx-4 -mt-3 px-4 pt-3 pb-3 ${TONES[tone].band}`}>
                <div className="flex items-center gap-2 pr-9">
                  <span
                    className="min-w-0 truncate text-[11px] font-medium
                      text-slate-600 dark:text-slate-300"
                  >
                    {metaText}
                  </span>
                  <span className="flex-1" />
                  <span
                    className={`flex shrink-0 items-center gap-1.5 text-[11px]
                      font-semibold ${statusText}`}
                  >
                    <span className={`size-[7px] rounded-full ${statusDot}`} />
                    {account.pendingSync ? "syncing…" : account.status}
                  </span>
                  {onToggleExpand && (
                    <button
                      type="button"
                      onClick={() => onToggleExpand(account.id)}
                      aria-label="Collapse"
                      className="relative z-10 -my-2 -mr-1 flex size-9 shrink-0
                        items-center justify-center rounded-full text-slate-500
                        transition hover:bg-white/60 dark:hover:bg-white/10"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[11px] font-medium text-slate-600
                        dark:text-slate-300"
                    >
                      principal
                    </p>
                    <p
                      className="truncate text-[28px] leading-none font-black
                        tracking-tight text-[#556477] tabular-nums
                        dark:text-foreground"
                    >
                      ₱{fmt(Number(account.principal_amount ?? 0))}
                    </p>
                  </div>
                  {release && releaseYmd && (
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p
                          className="text-[11px] font-medium text-slate-600
                            dark:text-slate-300"
                        >
                          {releasedYear
                            ? `released ${releasedYear}`
                            : "released"}
                        </p>
                        <p
                          className="text-[13px] font-bold text-[#556477]
                            dark:text-slate-100"
                        >
                          {releasedAgo}
                        </p>
                      </div>
                      <CalendarTile date={releaseYmd} />
                    </div>
                  )}
                </div>
              </div>

              {isPending && onActivate && (
                <button
                  type="button"
                  onClick={() => onActivate(account)}
                  className="relative z-10 mt-3 inline-flex items-center gap-1
                    rounded-md border border-slate-900/30 bg-emerald-50 px-3
                    py-1.5 text-[11px] font-bold text-emerald-800 transition
                    hover:bg-emerald-100 active:translate-y-px
                    dark:border-border/50 dark:bg-emerald-900/30
                    dark:text-emerald-300"
                >
                  activate
                </button>
              )}

              {/* Where the account stands */}
              {(!isPending || totalDue > 0) && !account.pendingSync && (
                <div className="mt-3 space-y-2.5">
                  {!isPending && (
                    <div className="grid grid-cols-3 gap-2">
                      <StatTile
                        label="left"
                        value={fmt(amountLeftToPay)}
                        tone="yellow"
                      />
                      <StatTile
                        label={isManual ? "paid" : "collected"}
                        value={fmt(totalPaid)}
                        tone="emerald"
                      />
                      <StatTile
                        label="ginansya"
                        value={fmt(profitPerSchedule)}
                        tone="teal"
                      />
                    </div>
                  )}

                  {useDots ? (
                    <div>
                      <div
                        className="flex items-center justify-between text-[11px]
                          font-semibold text-slate-600 dark:text-slate-300"
                      >
                        <span>
                          {paidInstallments} of {installments.length} paid
                        </span>
                        <span className="tabular-nums">
                          {installments.length > MAX_DOTS &&
                            dotPage.shown.length > 0 &&
                            `${dotPage.start + 1}–${dotPage.start + dotPage.shown.length} · `}
                          {progressPct}%
                        </span>
                      </div>
                      <ScheduleDots
                        installments={installments}
                        nextDate={
                          metrics?.nextCollectionDate?.slice(0, 10) ?? null
                        }
                      />
                    </div>
                  ) : (
                    totalDue > 0 && (
                      <div>
                        <div
                          className="mb-1.5 flex justify-end text-[11px]
                            font-semibold text-slate-600 tabular-nums
                            dark:text-slate-300"
                        >
                          {progressPct}%
                        </div>
                        <ProgressBar
                          paidPct={paidPct}
                          partialPct={partialPct}
                        />
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Upcoming */}
              {hasFooter && (
                <div
                  className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5
                    dark:border-border/40"
                >
                  {showCollections && nextPending && (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold tracking-wider
                          text-slate-400 uppercase dark:text-muted-foreground"
                      >
                        next
                      </span>
                      <span
                        className="text-[12px] font-bold text-slate-700
                          dark:text-slate-200"
                      >
                        {formatDate(nextPending.due_date)}
                      </span>
                      <span
                        className="rounded-full bg-yellow-100 px-2.5 py-0.5
                          text-[9px] font-black text-yellow-800 uppercase
                          dark:bg-yellow-900/40 dark:text-yellow-200"
                      >
                        pending
                      </span>
                      <span className="flex-1" />
                      <span
                        className="text-[13px] font-bold text-slate-700
                          tabular-nums dark:text-slate-100"
                      >
                        ₱{fmt(nextPending.amount)}
                      </span>
                    </div>
                  )}

                  {showCollections &&
                    partials.length > 0 &&
                    (() => {
                      const visible = partialsExpanded
                        ? partials
                        : partials.slice(0, 3);
                      const hidden = partials.length - visible.length;
                      return (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                            Partials
                          </p>
                          {visible.map((p, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">
                                  {formatDate(p.due_date)}
                                </span>
                                <span className="text-[12px] font-bold text-slate-700 tabular-nums dark:text-slate-200">
                                  ₱{fmt(p.amount)}
                                </span>
                                {p.amount_due > p.amount && (
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                    of ₱{fmt(p.amount_due)}
                                  </span>
                                )}
                              </div>
                              <span className="rounded-full border border-[#e6def2] bg-[#f6f2fb] px-2.5 py-0.5 text-[9px] font-black text-[#8a7aa8] uppercase dark:border-[#3b3449] dark:bg-[#251f2e] dark:text-[#bcaed6]">
                                partial
                              </span>
                            </div>
                          ))}
                          {hidden > 0 && (
                            <button
                              type="button"
                              onClick={() => setPartialsExpanded((v) => !v)}
                              className="relative z-10 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold text-slate-500 transition hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/5"
                            >
                              <span>
                                {partialsExpanded
                                  ? "Show less"
                                  : `+${hidden} more`}
                              </span>
                              <ChevronDown
                                className={`size-3 transition-transform ${partialsExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                        </div>
                      );
                    })()}

                  {hasOverdue && (
                    <div
                      className="overflow-hidden rounded-lg bg-rose-50
                        dark:bg-rose-950/30"
                    >
                      <button
                        type="button"
                        onClick={() => setOverdueExpanded((v) => !v)}
                        aria-expanded={overdueExpanded}
                        className="relative z-10 flex w-full items-center gap-2
                          px-3 py-2"
                      >
                        <div
                          className="flex size-5 shrink-0 items-center
                            justify-center rounded-full bg-rose-100 text-[10px]
                            font-bold text-rose-700 dark:bg-rose-800
                            dark:text-rose-100"
                        >
                          {overdueCount}
                        </div>
                        <span
                          className="text-[12px] font-bold text-rose-700
                            dark:text-rose-300"
                        >
                          overdue
                        </span>
                        <span
                          className="ml-auto text-[12px] font-bold text-rose-700
                            tabular-nums dark:text-rose-300"
                        >
                          ₱{fmt(overdueTotal)}
                        </span>
                        <ChevronDown
                          className={`size-3.5 text-rose-400
                            transition-transform
                            ${overdueExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                      <div
                        className={`grid transition-[grid-template-rows]
                          duration-200 ${
                            overdueExpanded
                              ? "grid-rows-[1fr]"
                              : "grid-rows-[0fr]"
                          }`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-1 px-3 pb-2">
                            {(metrics?.overdueSchedules ?? []).map((os, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between
                                  text-[12px]"
                              >
                                <span className="text-slate-500
                                  dark:text-slate-300">
                                  {formatDate(os.due_date)}
                                </span>
                                <span
                                  className="font-black text-red-700
                                    tabular-nums dark:text-red-100"
                                >
                                  ₱{fmt(os.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One button over the whole card; the controls above sit at z-10. */}
      <button
        type="button"
        onClick={handleMainClick}
        onPointerEnter={() => !selectionMode && onPrefetch?.(account.id)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-disabled={isOpening}
        aria-busy={isOpening}
        aria-expanded={onToggleExpand && !selectionMode ? expanded : undefined}
        aria-pressed={selectionMode ? !!selected : undefined}
        aria-label={`${
          selectionMode ? "Select" : expanded ? "Open" : "Expand"
        } account of ₱${fmt(Number(account.principal_amount ?? 0))}`}
        className="dark:focus-visible:ring-border absolute inset-0 z-[1] w-full
          cursor-pointer rounded-lg outline-none focus-visible:ring-2
          focus-visible:ring-slate-400 focus-visible:ring-inset"
      />

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="menu"
            className="absolute top-1 right-1 z-10"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.25, delay: 0.12 }}
          >
            {selectionMode ? (
              selectionBox
            ) : (
              <AccountCardMenu
                accountId={account.id}
                borrowerId={account.borrower_id}
                onEdit={() => onEdit(account)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
