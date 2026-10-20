import { Check } from "lucide-react";
import { memo, useRef } from "react";
import { formatDate } from "@/lib/utils";
import AccountCardMenu from "./account-card-menu";
import {
  AccountRow,
  AccountComputedMetrics,
} from "./borrower-accounts-section";
import type { InstallmentDot } from "@/lib/payment-schedule/installment-dots";
import { accountTone, SWIPE_TILE_TONES, TONES } from "@/lib/account-tones";
import { CalendarTile } from "@/components/calendar-tile";
import {
  barRightLabel,
  formatAmount,
  payoffPercent,
  releasedLabel,
} from "@/lib/account-card/summary";
import { SwipePanes, swipeDotStyle, swipeTileStyle } from "./swipe-panes";

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

const fmt = formatAmount;

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
            data-swipe="dot"
            style={swipeDotStyle}
            className={`mx-auto flex size-[26px] items-center justify-center
            rounded-md ${dotClasses(i.state, idx === nextIndex)}`}
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
}) {
  const amountLeftToPay = metrics?.amountLeftToPay ?? 0;
  const profitPerSchedule = metrics?.profitPerSchedule ?? 0;
  const totalDue = metrics?.totalDue ?? 0;
  const totalPaid = metrics?.totalPaid ?? 0;
  const overdueCount = metrics?.overdueCount ?? 0;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const isManual = account.schedule_mode === "manual";
  const isRolling = isManual && account.interest_type === "rolling";
  const isPending = account.status === "pending";
  const isCashAdvance = account.type === "cash_advance";
  const hasOverdue = overdueCount > 0;
  const termMonths = Number(metrics?.term_months) || 1;

  const installments = metrics?.installments ?? [];
  const useDots = !isManual && !isPending && installments.length > 0;
  const partialPaid = installments
    .filter((i) => i.state === "partial")
    .reduce((sum, i) => sum + i.amount_paid, 0);
  const totalPct = payoffPercent(totalPaid, totalDue);
  const partialPct = Math.min(payoffPercent(partialPaid, totalDue), totalPct);
  const paidPct = Math.max(0, totalPct - partialPct);

  const showCollections = !isPending && (!isManual || isRolling);
  const nextPending =
    metrics?.nextCollections?.find((nc) => nc.status === "pending") ?? null;
  // Pending and still-syncing accounts have nothing to swipe to.
  const hasDetails = !isPending && !account.pendingSync;

  const metaText = isPending
    ? "pending"
    : [
        account.interest_rate != null ? `${account.interest_rate}%` : null,
        isManual ? null : account.payment_frequency,
        isManual ? null : `${termMonths}mo`,
      ]
        .filter(Boolean)
        .join(" · ");
  const releaseYmd = account.release_date?.slice(0, 10) ?? null;
  const tone = accountTone({ isManual, isRolling, isCashAdvance });
  const principal = Number(account.principal_amount ?? 0);

  function handleMainClick() {
    if (isOpening) return;
    if (selectionMode) {
      onToggleSelect?.(account.id);
      return;
    }
    onOpen(account.id);
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressStart.current = null;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (selectionMode) return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      onToggleSelect?.(account.id);
    }, 500);
  }

  // A swipe is not a long press: moving 8px cancels it.
  function handlePointerMove(e: React.PointerEvent) {
    const start = pressStart.current;
    if (!start || !longPressTimer.current) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
      clearLongPress();
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

  // One button over a pane; the controls above it sit at z-10. It lives in the
  // pane (not over the card) so a horizontal drag scrolls the track.
  const paneButton = (
    <button
      type="button"
      onClick={handleMainClick}
      onPointerEnter={() => !selectionMode && onPrefetch?.(account.id)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      aria-disabled={isOpening}
      aria-busy={isOpening}
      aria-pressed={selectionMode ? !!selected : undefined}
      aria-label={`${selectionMode ? "Select" : "Open"} account of ₱${fmt(principal)}`}
      className="dark:focus-visible:ring-border absolute inset-0 z-[1] w-full
        cursor-pointer outline-none focus-visible:ring-2
        focus-visible:ring-slate-400 focus-visible:ring-inset"
    />
  );

  const summaryPane = (
    <div className="relative px-4 pt-3 pb-3">
      {paneButton}
      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
        principal
      </p>
      <p
        className="truncate text-[28px] leading-none font-black tracking-tight
          text-[#556477] tabular-nums dark:text-foreground"
      >
        ₱{fmt(principal)}
      </p>
      {hasDetails ? (
        <>
          <ProgressBar
            paidPct={paidPct}
            partialPct={partialPct}
            className="mt-2.5 h-1.5"
          />
          <div className="mt-1.5 flex justify-between gap-2 text-xs">
            <span
              className="font-semibold text-slate-600 tabular-nums
                dark:text-slate-300"
            >
              ₱{fmt(amountLeftToPay)} left
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {barRightLabel({ isManual, installments, totalPaid })}
            </span>
          </div>
          {showCollections && (nextPending || hasOverdue) && (
            <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-300">
              {nextPending && (
                <>
                  next{" "}
                  <b
                    className="font-extrabold text-slate-800
                      dark:text-slate-100"
                  >
                    {shortDate(nextPending.due_date)} · ₱
                    {fmt(nextPending.amount)}
                  </b>
                </>
              )}
              {hasOverdue && (
                <b className="font-extrabold text-rose-600 dark:text-rose-400">
                  {nextPending ? " · " : ""}
                  {overdueCount} overdue
                </b>
              )}
            </p>
          )}
        </>
      ) : (
        isPending && (
          <div className="mt-2 flex items-center gap-3">
            <span
              className="text-xs font-bold text-amber-700 dark:text-amber-300"
            >
              Pending activation
            </span>
            {onActivate && (
              <button
                type="button"
                onClick={() => onActivate(account)}
                className="relative z-10 inline-flex min-h-9 items-center
                  rounded-md border border-slate-900/30 bg-emerald-50 px-3
                  text-[11px] font-bold text-emerald-800 transition
                  hover:bg-emerald-100 active:translate-y-px
                  dark:border-border/50 dark:bg-emerald-900/30
                  dark:text-emerald-300"
              >
                activate
              </button>
            )}
          </div>
        )
      )}
    </div>
  );

  const tiles = [
    { label: "left", value: amountLeftToPay },
    { label: isManual ? "paid" : "collected", value: totalPaid },
    { label: "ginansya", value: profitPerSchedule },
    { label: "total due", value: totalDue },
  ];
  const detailsPane = (
    <div className="relative px-4 pt-3 pb-3">
      {paneButton}
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            data-swipe="tile"
            style={swipeTileStyle}
            className={`min-w-0 rounded-xl border px-2.5 py-1.5
            ${SWIPE_TILE_TONES[i].box}`}
          >
            <p
              className={`truncate text-[11px] font-semibold
              ${SWIPE_TILE_TONES[i].label}`}
            >
              {t.label}
            </p>
            <p
              className="truncate text-sm font-black tracking-tight
                text-slate-700 tabular-nums dark:text-slate-100"
            >
              ₱{fmt(t.value)}
            </p>
          </div>
        ))}
      </div>
      {useDots && (
        <ScheduleDots
          installments={installments}
          nextDate={metrics?.nextCollectionDate?.slice(0, 10) ?? null}
        />
      )}
    </div>
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
      {/* Band: coloured by kind of account; release age, rate and status */}
      <div
        className={`flex items-center gap-2.5 py-2 pr-12 pl-3
          ${TONES[tone].band}`}
      >
        {releaseYmd && (
          <CalendarTile
            date={releaseYmd}
            size="sm"
            className="border-slate-200 dark:border-border"
            bandClassName="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
            title={`Released ${formatDate(releaseYmd)}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold text-slate-800
              dark:text-slate-100"
          >
            {releasedLabel(metrics?.daysSinceRelease ?? 0)}
          </p>
          <p
            className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium
              text-slate-600 dark:text-slate-300"
          >
            <span className="truncate">{metaText}</span>
            <span
              className={`flex shrink-0 items-center gap-1 font-semibold
                ${statusText}`}
            >
              <span className={`size-[7px] rounded-full ${statusDot}`} />
              {account.pendingSync ? "syncing…" : account.status}
            </span>
          </p>
        </div>
      </div>
      <div className="absolute top-0.5 right-1 z-10">
        {selectionMode ? (
          selectionBox
        ) : (
          <AccountCardMenu
            accountId={account.id}
            borrowerId={account.borrower_id}
            onEdit={() => onEdit(account)}
          />
        )}
      </div>

      <SwipePanes
        panes={hasDetails ? [summaryPane, detailsPane] : [summaryPane]}
        labels={["Summary", "Details"]}
      />
    </div>
  );
});
