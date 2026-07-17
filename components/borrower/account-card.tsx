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
  const overdueCount = metrics?.overdueCount ?? 0;
  const overdueTotal = metrics?.overdueTotal ?? 0;
  const [overdueExpanded, setOverdueExpanded] = useState(overdueCount <= 6);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManual = account.schedule_mode === "manual";
  const isRolling = isManual && (account as any).interest_type === "rolling";
  const freq = account.payment_frequency;
  const termMonths = Number(metrics?.term_months) || 1;
  function fmtCompact(n: number) {
    if (n < 1000) return n.toLocaleString();
    const k = n / 1000;
    return `${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  function fmtTimeAgo(days: number) {
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.round(days / 7)}w ago`;
    if (days < 365) return `${Math.round(days / 30)}mo ago`;
    return `${Math.round(days / 365)}y ago`;
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
      ? "bg-cyan-200 text-cyan-900 dark:bg-cyan-800 dark:text-cyan-100"
      : "bg-lime-200 text-lime-900 dark:bg-lime-800 dark:text-lime-100"
    : isCashAdvance
      ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
      : "bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-100";

  const statusColors =
    account.status === "active"
      ? {
          bg: "bg-emerald-100",
          text: "text-emerald-700",
          border: "border-emerald-200",
          darkBg: "dark:bg-emerald-800",
          darkText: "dark:text-emerald-100",
          darkBorder: "dark:border-[#020617]",
        }
      : account.status === "pending"
        ? {
            bg: "bg-amber-100",
            text: "text-amber-700",
            border: "border-amber-200",
            darkBg: "dark:bg-amber-800",
            darkText: "dark:text-amber-100",
            darkBorder: "dark:border-[#020617]",
          }
        : {
            bg: "bg-slate-100",
            text: "text-slate-600",
            border: "border-slate-200",
            darkBg: "dark:bg-slate-700",
            darkText: "dark:text-slate-100",
            darkBorder: "dark:border-[#020617]",
          };

  return (
    <motion.div
      className={`relative overflow-hidden rounded-lg border border-slate-300
        bg-white transition-all duration-200 dark:border-border dark:bg-card
        ${isOpening ? "scale-[0.98] opacity-60" : ""}
        ${selectionMode && selected ? "ring-2 ring-slate-900 dark:ring-amber-400" : ""}`}
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
        className="dark:focus-visible:ring-border w-full min-w-0 cursor-pointer
          px-4 py-3 text-left outline-none focus-visible:ring-2
          focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black
                tracking-wide uppercase ${typeBadgeBg}`}
            >
              {typeLabel}
            </span>
            {account.status !== "pending" && (
              <span
                className="text-[11px] font-bold text-slate-500
                  dark:text-slate-400"
              >
                {account.interest_rate}%
              </span>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full mr-3 translate-y-[4px] px-2.5
              py-0.5 text-[8px] font-black uppercase ${statusColors.bg}
              ${statusColors.text}`}
          >
            {account.status}
          </span>
        </div>

        {/* Principal */}
        <div className="mt-1.5">
          <span
            className="text-2xl font-bold tracking-tight text-slate-600
              tabular-nums dark:text-foreground"
          >
            ₱{Number(account.principal_amount ?? 0).toLocaleString()}
          </span>
          <span
            className="ml-1.5 text-[11px] font-medium text-slate-500
              dark:text-muted-foreground"
          >
            {account.status === "pending"
              ? "pending"
              : !isManual
                ? `${account.payment_frequency} · ${account.term_months}mo`
                : isRolling
                  ? "manual"
                  : "manual"}
          </span>
        </div>

        {/* Release date */}
        {account.release_date && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold
                tracking-wide text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
            >
              {formatDate(account.release_date)}
            </span>
            {daysSinceRelease > 0 && (
              <span
                className="text-[11px] font-medium text-slate-500
                  dark:text-muted-foreground"
              >
                released {fmtTimeAgo(daysSinceRelease)}
              </span>
            )}
          </div>
        )}

        {account.status === "pending" && onActivate && (
          <button
            type="button"
            data-prevent-account-open
            onClick={() => onActivate(account)}
            className="mt-2.5 inline-flex items-center gap-1 rounded-md border
              border-slate-900/30 bg-emerald-50 px-3 py-1.5 text-[11px]
              font-bold text-emerald-800 transition hover:bg-emerald-100
              active:translate-y-px dark:border-border/50 dark:bg-emerald-900/30
              dark:text-emerald-300"
          >
            activate
          </button>
        )}

        {/* Metrics */}
        {account.status !== "pending" && (
          <div className="mt-3 flex items-center gap-4">
            <div>
              <p
                className="text-[9px] font-bold tracking-wider text-slate-500
                  uppercase dark:text-muted-foreground"
              >
                Remaining
              </p>
              <p
                className="text-sm font-bold text-rose-400 tabular-nums
                  dark:text-rose-400"
              >
                ₱{fmtCompact(amountLeftToPay)}
              </p>
            </div>
            <div>
              <p
                className="text-[9px] font-bold tracking-wider text-slate-500
                  uppercase dark:text-muted-foreground"
              >
                {isManual ? "Paid" : "Collected"}
              </p>
              <p
                className="text-sm font-bold text-emerald-700 tabular-nums
                  dark:text-emerald-300"
              >
                ₱{fmtCompact(totalPaid)}
              </p>
            </div>
            {profitToMake > 0 && (
              <div>
                <p
                  className="text-[9px] font-bold tracking-wider text-slate-500
                    uppercase dark:text-muted-foreground"
                >
                  ginansya
                </p>
                <p
                  className="text-sm font-bold text-[#6f537b] tabular-nums
                    dark:text-violet-300"
                >
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
              <span className="font-medium text-slate-400 dark:text-slate-500">
                Progress
              </span>
              <span
                className="font-bold text-slate-700 tabular-nums
                  dark:text-slate-300"
              >
                {progressPct}%
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100
                dark:bg-slate-800"
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
          </div>
        )}

        {/* Collections */}
        {account.status !== "pending" && (!isManual || isRolling) && (
          <>
            {/* Next pending */}
            {(() => {
              const nextPending =
                metrics?.nextCollections?.find(
                  (nc) => nc.status === "pending",
                ) ?? null;
              if (!nextPending) return null;
              return (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-border/50 dark:bg-card">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase dark:text-muted-foreground">
                    next
                  </span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {formatDate(nextPending.due_date)}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-100">
                    ₱{nextPending.amount.toLocaleString()}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[8px] font-black uppercase text-amber-700 dark:bg-amber-800 dark:text-amber-100">
                    pending
                  </span>
                </div>
              );
            })()}

            {/* Partials */}
            {(() => {
              const partials =
                metrics?.nextCollections?.filter(
                  (nc) => nc.status === "partial",
                ) ?? [];
              if (partials.length === 0) return null;
              const [expanded, setExpanded] = useState(false);
              const visible = expanded ? partials : partials.slice(0, 3);
              const hidden = partials.length - visible.length;
              return (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Partials
                  </p>
                  {visible.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-border/50 dark:bg-card"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {formatDate(p.due_date)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 tabular-nums dark:text-slate-200">
                          ₱{p.amount.toLocaleString()}
                        </span>
                        {p.amount_due > p.amount && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            of ₱{p.amount_due.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[8px] font-black uppercase text-purple-700 dark:bg-purple-800 dark:text-purple-100">
                        partial
                      </span>
                    </div>
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      data-prevent-account-open
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((v) => !v);
                      }}
                      className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold text-slate-500 transition hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/5"
                    >
                      <span>{expanded ? "Show less" : `+${hidden} more`}</span>
                      <ChevronDown
                        className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* Overdue alert */}
        {hasOverdue && (
          <div
            className="mt-3 overflow-hidden rounded-lg border border-slate-200
              bg-white dark:border-border/50 dark:bg-card"
          >
            <button
              type="button"
              data-prevent-account-open
              onClick={() => setOverdueExpanded((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2"
            >
              <div
                className="flex size-5 shrink-0 items-center justify-center
                  rounded-full bg-rose-100 text-[10px] font-bold text-rose-700
                  dark:bg-rose-800 dark:text-rose-100"
              >
                {overdueCount}
              </div>
              <span
                className="text-[11px] font-bold text-rose-700
                  dark:text-rose-300"
              >
                overdue
              </span>
              <span
                className="ml-auto text-[11px] font-bold text-rose-700
                  tabular-nums dark:text-rose-300"
              >
                ₱{overdueTotal.toLocaleString()}
              </span>
              <ChevronDown
                className={`size-3.5 text-rose-400 transition-transform
                dark:text-rose-400 ${overdueExpanded ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-200
              ${overdueExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="space-y-1 px-3 pb-2">
                  {(metrics?.overdueSchedules ?? []).map((os, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-500 dark:text-slate-300">
                        {formatDate(os.due_date)}
                      </span>
                      <span
                        className="font-black text-red-700 dark:text-red-100"
                      >
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
            className={`flex size-5 items-center justify-center rounded border
              transition-colors ${
                selected
                  ? `border-slate-900 bg-slate-900 dark:border-border
                    dark:bg-amber-400`
                  : "border-slate-300 bg-white dark:border-border dark:bg-card"
              }`}
            aria-label={selected ? "Deselect account" : "Select account"}
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
