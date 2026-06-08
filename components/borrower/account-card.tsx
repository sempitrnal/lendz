import { ChevronDown } from "lucide-react";
import { useState, SyntheticEvent, useRef } from "react";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";
import AccountCardMenu from "./account-card-menu";
import {
  AccountRow,
  AccountComputedMetrics,
} from "./borrower-accounts-section";

export function AccountCard({
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
  const profitToMake = metrics?.profitToMake ?? 0;
  const daysSinceRelease = metrics?.daysSinceRelease ?? 0;
  const profitPerSchedule = metrics?.profitPerSchedule ?? 0;
  const totalDue = metrics?.totalDue ?? 0;
  const totalPaid = metrics?.totalPaid ?? 0;
  const progressPct =
    totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
  const nextCollectionDate = metrics?.nextCollectionDate;
  const nextCollectionAmount = metrics?.nextCollectionAmount ?? 0;
  const nextCollectionAmountDue = metrics?.nextCollectionAmountDue ?? 0;
  const nextCollectionStatus = metrics?.nextCollectionStatus ?? null;
  const overdueCount = metrics?.overdueCount ?? 0;
  const overdueTotal = metrics?.overdueTotal ?? 0;
  const [overdueExpanded, setOverdueExpanded] = useState(overdueCount <= 6);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManual = account.schedule_mode === "manual";
  const isRolling = isManual && (account as any).interest_type === "rolling";
  const freq = account.payment_frequency;
  const termMonths = Number(metrics?.term_months) || 1;
  const perPayrollDivisor =
    freq === "custom"
      ? Number(metrics?.term_installments) || 1
      : freq === "bimonthly"
        ? termMonths * 2
        : freq === "weekly"
          ? termMonths * 4
          : termMonths;
  function fmtCompact(n: number) {
    if (n < 1000) return n.toLocaleString();
    const k = n / 1000;
    return `${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  function tryOpenAccount(e: SyntheticEvent) {
    if (isOpening) return;
    if ((e.target as HTMLElement).closest("[data-prevent-account-open]")) {
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(account.id);
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

  const isCashAdvance = account.type === "cash_advance";
  const accentStrip = isCashAdvance ? "bg-amber-400" : "bg-violet-500";
  const badgeBg = isCashAdvance
    ? "bg-amber-200 text-amber-900"
    : "bg-violet-200 text-violet-900";
  const hasOverdue = overdueCount > 0;

  const typeLabel = isManual
    ? isRolling
      ? "rolling"
      : "flat"
    : isCashAdvance
      ? "ca"
      : "loan";
  const typeBadgeBg = isManual
    ? isRolling
      ? "bg-cyan-200 text-cyan-900"
      : "bg-lime-200 text-lime-900"
    : badgeBg;

  const statusColors =
    account.status === "active"
      ? {
          bg: "bg-emerald-100",
          text: "text-emerald-700",
          border: "border-emerald-200",
          darkBg: "dark:bg-emerald-900/30",
          darkText: "dark:text-emerald-300",
          darkBorder: "dark:border-emerald-800",
        }
      : account.status === "pending"
        ? {
            bg: "bg-amber-100",
            text: "text-amber-700",
            border: "border-amber-200",
            darkBg: "dark:bg-amber-900/30",
            darkText: "dark:text-amber-300",
            darkBorder: "dark:border-amber-800",
          }
        : {
            bg: "bg-slate-100",
            text: "text-slate-600",
            border: "border-slate-200",
            darkBg: "dark:bg-slate-800",
            darkText: "dark:text-slate-400",
            darkBorder: "dark:border-slate-700",
          };

  return (
    <motion.div
      className={`dark:bg-card relative overflow-hidden rounded-2xl border bg-white transition-all duration-200 ${
        hasOverdue
          ? "border-red-300 shadow-[3px_3px_0px_0px_#ef4444] dark:border-red-700"
          : "border-slate-200 shadow-[3px_3px_0px_0px_#e2e8f0] dark:border-slate-700"
      } ${isOpening ? "scale-[0.98] opacity-60" : ""} ${selectionMode && selected ? "ring-2 ring-slate-900 dark:ring-amber-400" : ""}`}
      whileHover={
        isOpening
          ? undefined
          : {
              y: -2,
              transition: {
                type: "spring" as const,
                stiffness: 400,
                damping: 20,
              },
            }
      }
      whileTap={
        isOpening
          ? undefined
          : { scale: 0.98, y: 0, transition: { duration: 0.1 } }
      }
    >
      {/* Top accent */}
      <div className={`h-1 w-full ${accentStrip}`} />

      <div
        role="button"
        tabIndex={isOpening ? -1 : 0}
        onPointerEnter={() => !selectionMode && onPrefetch?.(account.id)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={tryOpenAccount}
        onKeyDown={(e) => {
          if (isOpening) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          if ((e.target as HTMLElement).closest("[data-prevent-account-open]"))
            return;
          if (selectionMode) {
            e.preventDefault();
            onToggleSelect?.(account.id);
            return;
          }
          e.preventDefault();
          onOpen(account.id);
        }}
        aria-disabled={isOpening}
        aria-busy={isOpening}
        aria-label="Open account"
        className="dark:focus-visible:ring-border w-full min-w-0 cursor-pointer px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wide uppercase ${typeBadgeBg} dark:border-slate-700`}
            >
              {typeLabel}
            </span>
            {account.status !== "pending" && (
              <span className="text-muted-foreground text-[11px] font-medium">
                {account.interest_rate}%
              </span>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${statusColors.bg} ${statusColors.text} ${statusColors.border} ${statusColors.darkBg} ${statusColors.darkText} ${statusColors.darkBorder}`}
          >
            {account.status}
          </span>
        </div>

        {/* Principal */}
        <div className="mt-1.5">
          <span className="dark:text-foreground text-2xl font-black tracking-tight text-slate-900 tabular-nums">
            ₱{Number(account.principal_amount ?? 0).toLocaleString()}
          </span>
          <span className="text-muted-foreground ml-1.5 text-[11px]">
            {account.status === "pending"
              ? "pending"
              : !isManual
                ? `${account.payment_frequency} · ${account.term_months}mo`
                : isRolling
                  ? "manual rolling"
                  : "manual flat"}
          </span>
        </div>

        {/* Release date */}
        {account.release_date && (
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            released{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {formatDate(account.release_date)}
            </span>
            {daysSinceRelease > 0 && (
              <span className="text-slate-400">
                {" "}
                · {daysSinceRelease} day{daysSinceRelease === 1 ? "" : "s"}
              </span>
            )}
          </p>
        )}

        {account.status === "pending" && onActivate && (
          <button
            type="button"
            data-prevent-account-open
            onClick={() => onActivate(account)}
            className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-sm transition hover:bg-emerald-600 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Activate
          </button>
        )}

        {/* Metrics grid */}
        {account.status !== "pending" && (
          <div
            className={`mt-3 grid gap-2 ${profitToMake > 0 ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Remaining
              </p>
              <p className="mt-0.5 text-sm font-black text-red-600 tabular-nums dark:text-red-400">
                ₱{fmtCompact(amountLeftToPay)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {isManual ? "Paid" : "Collected"}
              </p>
              <p
                className={`mt-0.5 text-sm font-black tabular-nums ${isManual ? "text-slate-800 dark:text-slate-200" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                ₱{fmtCompact(totalPaid)}
              </p>
            </div>
            {profitToMake > 0 && (
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Profit / Schedule
                </p>
                <p className="mt-0.5 text-sm font-black text-violet-600 tabular-nums dark:text-violet-400">
                  ₱{fmtCompact(profitPerSchedule)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {totalDue > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Progress</span>
              <span className="font-black text-slate-700 tabular-nums dark:text-slate-300">
                {progressPct}%
              </span>
            </div>
            <div
              className="dark:bg-muted mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500 dark:bg-emerald-400"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Next collection */}
        {(!isManual || isRolling) &&
          (metrics?.nextCollections?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Upcoming
              </p>
              {(metrics?.nextCollections ?? []).slice(0, 3).map((nc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {formatDate(nc.due_date)}
                    </span>
                    <span className="text-[11px] font-black text-slate-900 tabular-nums dark:text-slate-200">
                      ₱{nc.amount.toLocaleString()}
                    </span>
                    {nc.status === "partial" && nc.amount_due > nc.amount && (
                      <span className="text-[10px] text-slate-400">
                        of ₱{nc.amount_due.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {nc.status && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wide uppercase ${
                        nc.status === "overdue"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : nc.status === "paid"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : nc.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : nc.status === "partial"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}
                    >
                      {nc.status}
                    </span>
                  )}
                </div>
              ))}
              {(metrics?.nextCollections?.length ?? 0) > 3 && (
                <p className="text-center text-[10px] text-slate-400">
                  +{(metrics?.nextCollections?.length ?? 0) - 3} more
                </p>
              )}
            </div>
          )}

        {/* Overdue alert */}
        {hasOverdue && (
          <div className="mt-3 overflow-hidden rounded-xl border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20">
            <button
              type="button"
              data-prevent-account-open
              onClick={() => setOverdueExpanded((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2"
            >
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                {overdueCount}
              </div>
              <span className="text-[11px] font-bold text-red-700 dark:text-red-300">
                overdue
              </span>
              <span className="ml-auto text-[11px] font-black text-red-800 tabular-nums dark:text-red-300">
                ₱{overdueTotal.toLocaleString()}
              </span>
              <ChevronDown
                className={`size-3.5 text-red-500 transition-transform ${overdueExpanded ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ${overdueExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="space-y-1 px-3 pb-2">
                  {(metrics?.overdueSchedules ?? []).map((os, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatDate(os.due_date)}
                      </span>
                      <span className="font-black text-red-700 dark:text-red-300">
                        ₱{os.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectionMode ? (
        <div className="absolute top-3 right-3" data-prevent-account-open>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(account.id);
            }}
            className={`flex size-5 items-center justify-center rounded border-2 transition-colors ${
              selected
                ? "border-slate-900 bg-slate-900 dark:border-amber-400 dark:bg-amber-400"
                : "dark:bg-card border-slate-300 bg-white dark:border-slate-600"
            }`}
            aria-label={selected ? "Deselect account" : "Select account"}
          >
            {selected && (
              <svg
                className="size-3 text-white dark:text-slate-900"
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
          </button>
        </div>
      ) : (
        <div className="absolute top-3 right-3" data-prevent-account-open>
          <AccountCardMenu
            accountId={account.id}
            borrowerId={account.borrower_id}
            onEdit={() => onEdit(account)}
          />
        </div>
      )}
    </motion.div>
  );
}
