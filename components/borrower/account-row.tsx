"use client";

import { Check } from "lucide-react";
import { memo, useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { useAccountActions } from "./account-card-menu";
import type {
  AccountComputedMetrics,
  AccountRow as AccountRowData,
} from "./borrower-accounts-section";
import { GROUP_STYLES } from "./group-styles";
import {
  formatAmount,
  payoffPercent,
  shortDate,
} from "@/lib/account-card/summary";
import { HIDDEN_AMOUNT } from "@/lib/hide-amounts";

/** A pointer that moved further than this between down and up was a swipe. */
const TAP_SLOP_PX = 8;

/** What a row can run for the swipe buttons, which the page owns. */
export type RowActions = { revert: () => void; remove: () => void };

/**
 * One account as a row of the borrower page's list: the kind of account as an
 * icon, the principal, its terms and how far it's paid off, then what's left
 * and what's next. The whole row opens the account; a long press starts
 * selecting. It's the content of a swipeable list row (see the page): the
 * swipe, and the Edit, Revert and Delete behind it, belong to the list. The
 * row keeps the Revert and Delete dialogs and hands the page what opens them.
 * The Activate button sits above the row's tap target.
 */
export const AccountRow = memo(function AccountRow({
  account,
  group,
  hide,
  isOpening,
  onOpen,
  onPrefetch,
  onActivate,
  metrics,
  selectionMode,
  selected,
  onToggleSelect,
  swiped,
  onClose,
  actions,
}: {
  account: AccountRowData;
  /** The group's label ("loans", "cash advances"…): picks the icon and colours. */
  group: string;
  hide: boolean;
  isOpening: boolean;
  onOpen: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onActivate?: (account: AccountRowData) => void;
  metrics?: AccountComputedMetrics;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Whether this row's swipe actions are showing. */
  swiped: boolean;
  /** Closes them: a tap on an open row does that, not open the account. */
  onClose: () => void;
  /** Where the row lists what its swipe buttons run, by account id. */
  actions: RefObject<Map<string, RowActions>>;
}) {
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const { openRevert, openDelete, dialogs } = useAccountActions({
    accountId: account.id,
    borrowerId: account.borrower_id,
  });
  // The page's swipe buttons call through to the latest of these.
  const latest = useRef({ openRevert, openDelete });
  useEffect(() => {
    latest.current = { openRevert, openDelete };
  });
  useEffect(() => {
    const map = actions.current;
    map.set(account.id, {
      revert: () => void latest.current.openRevert(),
      remove: () => latest.current.openDelete(),
    });
    return () => {
      map.delete(account.id);
    };
  }, [actions, account.id]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const isManual = account.schedule_mode === "manual";
  const isRolling = isManual && account.interest_type === "rolling";
  const isPending = account.status === "pending";
  const overdueCount = metrics?.overdueCount ?? 0;
  const termMonths = Number(metrics?.term_months) || 1;
  const principal = Number(account.principal_amount ?? 0);
  const left = metrics?.amountLeftToPay ?? 0;
  const paidPct = payoffPercent(
    metrics?.totalPaid ?? 0,
    metrics?.totalDue ?? 0,
  );
  const nextPending =
    metrics?.nextCollections?.find((nc) => nc.status === "pending") ?? null;
  const showCollections = !isPending && (!isManual || isRolling);

  const terms = isPending
    ? "pending"
    : [
        account.interest_rate != null ? `${account.interest_rate}%` : null,
        isManual
          ? isRolling
            ? "manual rolling"
            : "manual flat"
          : account.payment_frequency,
        isManual ? null : `${termMonths}mo`,
      ]
        .filter(Boolean)
        .join(" · ");

  const style = GROUP_STYLES[group];
  const Icon = style?.icon;
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);

  /** True when the press that ended in this click was a drag, not a tap. */
  function wasDrag(e: React.MouseEvent) {
    const from = downAt.current;
    return (
      e.detail !== 0 &&
      !!from &&
      Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_SLOP_PX
    );
  }

  function handleMainClick(e: React.MouseEvent) {
    if (wasDrag(e)) return;
    if (swiped) return onClose();
    if (isOpening) return;
    if (selectionMode) {
      onToggleSelect?.(account.id);
      return;
    }
    onOpen(account.id);
  }

  const stopWatching = useRef<(() => void) | null>(null);

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressStart.current = null;
    stopWatching.current?.();
    stopWatching.current = null;
  }

  // The swipeable list owns the drag (and may capture the pointer), so the
  // row can't count on seeing the finger move: it watches at the window.
  // Moving 8px (a swipe, a scroll) or letting go cancels the long press.
  function handlePointerDown(e: React.PointerEvent) {
    downAt.current = { x: e.clientX, y: e.clientY };
    if (selectionMode) return;
    clearLongPress();
    const start = { x: e.clientX, y: e.clientY };
    pressStart.current = start;
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        clearLongPress();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", clearLongPress);
    window.addEventListener("pointercancel", clearLongPress);
    stopWatching.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", clearLongPress);
      window.removeEventListener("pointercancel", clearLongPress);
    };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      clearLongPress();
      onToggleSelect?.(account.id);
    }, 500);
  }

  // Leaving the page mid-press must not leave listeners or a timer behind.
  useEffect(() => clearLongPress, []);

  let status: React.ReactNode;
  if (account.pendingSync) {
    status = (
      <span className="text-[11px] font-bold text-sky-600 dark:text-sky-300">
        syncing…
      </span>
    );
  } else if (isPending) {
    status = onActivate ? (
      <button
        type="button"
        onClick={(e) => {
          if (wasDrag(e)) return;
          if (swiped) return onClose();
          onActivate(account);
        }}
        className="relative z-10 rounded-full bg-emerald-100 px-3 py-1
          text-[11px] font-bold text-emerald-700 active:bg-emerald-200
          dark:bg-emerald-500/20 dark:text-emerald-300"
      >
        Activate
      </button>
    ) : (
      <span className="text-[11px] font-bold text-amber-600">pending</span>
    );
  } else if (overdueCount > 0) {
    status = (
      <span className="text-[11px] font-bold text-rose-500">
        {overdueCount} overdue
      </span>
    );
  } else if (showCollections && nextPending) {
    status = (
      <span className="text-[11px] font-semibold text-muted-foreground">
        next {shortDate(nextPending.due_date)}
      </span>
    );
  } else {
    status = (
      <span className="text-[11px] font-semibold text-muted-foreground">
        {account.status}
      </span>
    );
  }

  return (
    <div
      data-tour="account-card"
      className={cn(
        "relative flex items-center gap-3 py-3 pr-4 pl-4 transition-opacity",
        isOpening && "opacity-60",
      )}
    >
      {selectionMode && selected && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-emerald-500/10"
        />
      )}
      {/* One button under the row's content; the controls sit above it. */}
      <button
        type="button"
        onClick={handleMainClick}
        onPointerEnter={() => !selectionMode && onPrefetch?.(account.id)}
        onPointerDown={handlePointerDown}
        aria-disabled={isOpening}
        aria-busy={isOpening}
        aria-pressed={selectionMode ? !!selected : undefined}
        aria-label={`${selectionMode ? "Select" : "Open"} account of ₱${formatAmount(principal)}`}
        className="absolute inset-0 z-[1] w-full cursor-pointer outline-none
          focus-visible:ring-2 focus-visible:ring-slate-400
          focus-visible:ring-inset active:bg-black/[0.03]
          dark:active:bg-white/[0.04]"
      />
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          style?.badge ?? "bg-slate-100 text-slate-600",
        )}
      >
        {Icon && <Icon className="size-4" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p
          // Manrope stops at 800, so the extra weight is a hairline stroke.
          className="text-[22px] leading-tight font-black tracking-tight
            text-card-foreground/70 tabular-nums
            [-webkit-text-stroke:0.5px_currentColor]"
        >
          {mask(`₱${formatAmount(principal)}`)}
        </p>
        <p className="truncate text-xs font-semibold text-muted-foreground">
          {terms}
        </p>
        {!isPending && !account.pendingSync && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width]
                duration-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="text-[15px] font-extrabold text-card-foreground/70
            tabular-nums [-webkit-text-stroke:0.3px_currentColor]"
        >
          {mask(`₱${formatAmount(left)}`)}
        </span>
        {status}
      </div>
      {selectionMode && (
        <button
          type="button"
          onClick={() => onToggleSelect?.(account.id)}
          className="relative z-10 flex size-10 shrink-0 items-center
            justify-center"
          aria-label={selected ? "Deselect account" : "Select account"}
          aria-pressed={!!selected}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded border",
              selected
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 bg-white dark:border-border dark:bg-card",
            )}
          >
            {selected && <Check className="size-3.5" strokeWidth={3} />}
          </span>
        </button>
      )}
      {dialogs}
    </div>
  );
});
