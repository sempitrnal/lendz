import { ChevronDown } from "lucide-react";
import { useState, SyntheticEvent, useRef } from "react";
import { motion } from "framer-motion";
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

  return (
    <motion.div
      className={`bg-solar dark:bg-card relative overflow-hidden rounded-xl border-2 transition-all duration-150 ${
        hasOverdue
          ? "border-red-700 shadow-[4px_4px_0px_0px_#b91c1c]"
          : "dark:border-border border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
      } ${isOpening ? "scale-[0.98] opacity-60" : ""} ${selectionMode && selected ? "ring-2 ring-slate-900 dark:ring-amber-400" : ""}`}
      whileHover={
        isOpening
          ? undefined
          : {
              y: -3,
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
      {/* Left accent strip */}
      <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${accentStrip}`} />

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
        className="dark:focus-visible:ring-border w-full min-w-0 cursor-pointer py-2 pr-10 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        {/* Row 1: type badge + principal + status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`shrink-0 rounded-full border border-slate-900 px-1.5 py-0.5 text-[9px] font-black uppercase ${typeBadgeBg}`}
          >
            {typeLabel}
          </span>
          <span className="dark:text-foreground text-lg leading-none font-black text-slate-900 tabular-nums">
            ₱{Number(account.principal_amount ?? 0).toLocaleString()}
          </span>
          <span
            className={`dark:border-border ml-auto shrink-0 rounded-full border border-slate-900 px-1.5 py-0.5 text-[9px] font-black uppercase ${
              account.status === "active"
                ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-200"
                : account.status === "pending"
                  ? "bg-amber-200 text-amber-900 dark:bg-amber-800/50 dark:text-amber-200"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {account.status}
          </span>
        </div>

        {/* Row 2: meta */}
        <p className="dark:text-muted-foreground mt-0.5 text-[10px] text-slate-400">
          {!isManual && account.status !== "pending"
            ? `${account.payment_frequency} · ${account.term_months}mo · `
            : account.status === "pending"
              ? "pending · "
              : isRolling
                ? "manual rolling · "
                : "manual flat · "}
          {account.interest_rate}%
          {account.release_date &&
            ` · ${new Date(account.release_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
        </p>

        {account.status === "pending" && onActivate && (
          <button
            type="button"
            data-prevent-account-open
            onClick={() => onActivate(account)}
            className="dark:border-border mt-2 inline-flex items-center rounded-lg border-2 border-slate-900 bg-emerald-400 px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none dark:bg-emerald-700/50 dark:text-emerald-100"
          >
            activate account
          </button>
        )}

        {/* Row 3: stats — hidden when pending */}
        {account.status !== "pending" && (
          <p className="dark:text-muted-foreground mt-1 text-[11px] leading-snug text-slate-500">
            <span>Remaining </span>
            <strong className="font-black text-red-700 dark:text-red-400">
              ₱{amountLeftToPay.toLocaleString()}
            </strong>
            {isManual ? (
              <>
                <span className="dark:text-border text-slate-300"> · </span>
                <span>Paid </span>
                <strong className="dark:text-foreground font-black text-slate-900">
                  ₱{totalPaid.toLocaleString()}
                </strong>
              </>
            ) : (
              <>
                <span className="dark:text-border text-slate-300"> · </span>
                <span>Collected </span>
                <strong className="font-black text-green-700 dark:text-green-400">
                  ₱{totalPaid.toLocaleString()}
                </strong>
                <span className="dark:text-border text-slate-300"> · </span>
                <span>Profit </span>
                <strong className="dark:text-foreground font-black text-slate-900">
                  ₱{Math.round(profitToMake).toLocaleString()}
                </strong>
                <span className="dark:text-border text-slate-300"> · </span>
                <strong className="dark:text-foreground font-black text-slate-900">
                  ₱
                  {Math.round(
                    profitToMake / perPayrollDivisor,
                  ).toLocaleString()}
                </strong>
                <span>/pay</span>
              </>
            )}
          </p>
        )}
        <span className="text-sm lowercase">Next</span>

        {/* Row 4: next collections (all partial + next pending) */}
        {(!isManual || isRolling) &&
          (metrics?.nextCollections?.length ?? 0) > 0 && (
            <div className="mt-1 space-y-0.5">
              {(metrics?.nextCollections ?? []).map((nc, i) => (
                <p
                  key={i}
                  className="dark:text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] leading-snug text-slate-500"
                >
                  <strong className="dark:text-foreground w-12 font-black text-slate-900">
                    {new Date(nc.due_date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </strong>
                  <strong className="dark:text-foreground font-black text-slate-700 tabular-nums">
                    ₱{nc.amount.toLocaleString()}
                  </strong>
                  {nc.status === "partial" && nc.amount_due > nc.amount && (
                    <span className="dark:text-muted-foreground text-slate-400">
                      of ₱{nc.amount_due.toLocaleString()}
                    </span>
                  )}
                  {nc.status && (
                    <span
                      className={`dark:border-border border border-slate-900 px-1 py-0.5 text-[7px] font-black uppercase ${
                        nc.status === "overdue"
                          ? "bg-red-300 text-red-900 dark:bg-red-700/50 dark:text-red-200"
                          : nc.status === "paid"
                            ? "bg-emerald-300 text-emerald-900 dark:bg-emerald-700/50 dark:text-emerald-200"
                            : nc.status === "pending"
                              ? "bg-yellow-300 text-yellow-900 dark:bg-yellow-700/50 dark:text-yellow-200"
                              : nc.status === "partial"
                                ? "bg-purple-300 text-purple-900 dark:bg-purple-700/50 dark:text-purple-200"
                                : "bg-blue-300 text-blue-900 dark:bg-blue-700/50 dark:text-blue-200"
                      }`}
                    >
                      {nc.status}
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}

        {/* Overdue */}
        {hasOverdue && (
          <div className="mt-3 rounded-sm border border-red-400 bg-red-100 p-1 dark:border-red-800 dark:bg-red-900/30">
            <button
              type="button"
              data-prevent-account-open
              onClick={() => setOverdueExpanded((v) => !v)}
              className="flex w-full items-center gap-1 text-[11px]"
            >
              <span className="font-black text-red-600 dark:text-red-300">
                ⚠ {overdueCount} overdue
              </span>
              <span className="font-black text-red-800 tabular-nums dark:text-red-300">
                ₱{overdueTotal.toLocaleString()}
              </span>
              <ChevronDown
                className={`ml-auto size-3 text-red-600 transition-transform duration-200 dark:text-red-400 ${overdueExpanded ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ${overdueExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="mt-0.5 space-y-0.5 pl-1">
                  {(metrics?.overdueSchedules ?? []).map((os, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 text-[10px]"
                    >
                      <span className="dark:text-muted-foreground text-slate-600">
                        {new Date(os.due_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
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

        {/* Progress bar */}
        {totalDue > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div
              className="dark:bg-muted h-1 flex-1 overflow-hidden bg-slate-100"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="dark:text-muted-foreground shrink-0 text-[9px] text-slate-400 tabular-nums">
              {progressPct}%
            </span>
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
