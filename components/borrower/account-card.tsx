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
  const typeAccent = isCashAdvance
    ? isManual
      ? isRolling
        ? {
            border: "border-teal-500",
            shadow: "#14b8a6",
            strip: "bg-teal-500",
            darkStrip: "dark:bg-teal-400",
          }
        : {
            border: "border-yellow-500",
            shadow: "#eab308",
            strip: "bg-yellow-500",
            darkStrip: "dark:bg-yellow-400",
          }
      : {
          border: "border-amber-500",
          shadow: "#f59e0b",
          strip: "bg-amber-500",
          darkStrip: "dark:bg-amber-400",
        }
    : isManual
      ? isRolling
        ? {
            border: "border-cyan-500",
            shadow: "#06b6d4",
            strip: "bg-cyan-500",
            darkStrip: "dark:bg-cyan-400",
          }
        : {
            border: "border-lime-500",
            shadow: "#84cc16",
            strip: "bg-lime-500",
            darkStrip: "dark:bg-lime-400",
          }
      : {
          border: "border-violet-500",
          shadow: "#8b5cf6",
          strip: "bg-violet-500",
          darkStrip: "dark:bg-violet-400",
        };
  const accentStrip = `${typeAccent.strip} ${typeAccent.darkStrip}`;
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
      className={`relative overflow-hidden rounded-xl border-2 border-[#8158a3]
        bg-[#f1fff2] shadow-[4px_4px_0px_0px_#8158a3] transition-all
        duration-200 dark:border-[#020617] dark:bg-slate-900
        dark:shadow-[4px_4px_0px_0px_#020617] ${
          account.status === "pending" ? "bg-amber-100 dark:bg-slate-900" : ""
        }
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
      {/* Top accent */}
      <div className={`h-1.5 w-full ${accentStrip}`} />

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
              className={`shrink-0 rounded-md border-2 px-2 py-0.5 text-[10px]
                font-black tracking-wide uppercase
                shadow-[2px_2px_0px_0px_#0f172a]
                dark:shadow-[2px_2px_0px_0px_#020617] ${typeBadgeBg}
                dark:border-[#020617]`}
            >
              {typeLabel}
            </span>
            {account.status !== "pending" && (
              <span
                className="text-[11px] font-black text-slate-900
                  dark:text-slate-100"
              >
                {account.interest_rate}%
              </span>
            )}
          </div>
          <span
            className={`shrink-0 mr-3 rounded-full border-2 px-2.5 py-0.5
              text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#0f172a]
              dark:shadow-[2px_2px_0px_0px_#020617] ${statusColors.bg}
              ${statusColors.text} ${statusColors.border} ${statusColors.darkBg}
              ${statusColors.darkText} ${statusColors.darkBorder}`}
          >
            {account.status}
          </span>
        </div>

        {/* Principal */}
        <div className="mt-1.5">
          <span
            className="text-2xl font-black tracking-tight text-slate-900
              tabular-nums dark:text-white"
          >
            ₱{Number(account.principal_amount ?? 0).toLocaleString()}
          </span>
          <span
            className="ml-1.5 text-[11px] font-bold text-slate-500
              dark:text-slate-400"
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
              className="rounded-md border-2 border-slate-900 bg-sky-200 px-2
                py-0.5 text-[10px] font-black tracking-wide text-sky-900
                shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617]
                dark:bg-sky-800 dark:text-sky-100
                dark:shadow-[2px_2px_0px_0px_#020617]"
            >
              {formatDate(account.release_date)}
            </span>
            {daysSinceRelease > 0 && (
              <span
                className="text-[11px] font-bold text-slate-500
                  dark:text-slate-400"
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
            className="mt-2.5 inline-flex items-center gap-1 rounded-lg border-2
              border-slate-900 bg-emerald-400 px-3 py-1.5 text-[11px] font-black
              tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]
              transition hover:translate-y-px
              hover:shadow-[1px_1px_0px_0px_#0f172a] active:translate-y-[2px]
              active:shadow-none dark:border-[#020617] dark:bg-emerald-500
              dark:shadow-[2px_2px_0px_0px_#020617]
              dark:hover:shadow-[1px_1px_0px_0px_#020617]"
          >
            Activate
          </button>
        )}

        {/* Metrics grid */}
        {account.status !== "pending" && (
          <div
            className={`mt-3 grid gap-2
            ${profitToMake > 0 ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <div
              className="rounded-lg border-2 border-slate-900 bg-amber-50 p-2
                shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617]
                dark:bg-amber-900/30 dark:shadow-[2px_2px_0px_0px_#020617]"
            >
              <p
                className="text-[10px] font-black tracking-wider text-slate-500
                  uppercase dark:text-slate-400"
              >
                Remaining
              </p>
              <p
                className="mt-0.5 text-sm font-black text-red-600 tabular-nums
                  dark:text-red-400"
              >
                ₱{fmtCompact(amountLeftToPay)}
              </p>
            </div>
            <div
              className="rounded-lg border-2 border-slate-900 bg-emerald-50 p-2
                shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617]
                dark:bg-emerald-900/30 dark:shadow-[2px_2px_0px_0px_#020617]"
            >
              <p
                className="text-[10px] font-black tracking-wider text-slate-500
                  uppercase dark:text-slate-400"
              >
                {isManual ? "Paid" : "Collected"}
              </p>
              <p
                className="mt-0.5 text-sm font-black text-emerald-700
                  tabular-nums dark:text-emerald-300"
              >
                ₱{fmtCompact(totalPaid)}
              </p>
            </div>
            {profitToMake > 0 && (
              <div
                className="rounded-lg border-2 border-slate-900 bg-violet-50 p-2
                  shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617]
                  dark:bg-violet-900/30 dark:shadow-[2px_2px_0px_0px_#020617]"
              >
                <p
                  className="text-[10px] font-black tracking-wider
                    text-slate-500 uppercase dark:text-slate-400"
                >
                  per sched
                </p>
                <p
                  className="mt-0.5 text-sm font-black text-violet-700
                    tabular-nums dark:text-violet-300"
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
              <span className="font-semibold text-slate-400">Progress</span>
              <span
                className="font-black text-slate-700 tabular-nums
                  dark:text-slate-300"
              >
                {progressPct}%
              </span>
            </div>
            <div
              className="mt-1.5 h-3 overflow-hidden rounded-full border-2
                border-slate-900 bg-white dark:border-[#020617]
                dark:bg-slate-900"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-400 transition-all duration-500
                  dark:bg-emerald-500"
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
                <div className="mt-3 flex items-center gap-2 rounded-sm border border-slate-900 bg-amber-100/80 p-2 dark:bg-[#092e40]">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Next pending
                  </span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {formatDate(nextPending.due_date)}
                  </span>
                  <span className="text-[11px] font-black text-slate-900 tabular-nums dark:text-slate-100">
                    ₱{nextPending.amount.toLocaleString()}
                  </span>
                  <span className="rounded-md border-2 border-slate-900 bg-amber-200 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-amber-700 uppercase shadow-[1px_1px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-amber-800 dark:text-amber-100 dark:shadow-[1px_1px_0px_0px_#020617]">
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
                      className="bgp flex items-center justify-between gap-2 rounded-lg border-2 border-slate-900 bg-purple-100 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-purple-950/50 dark:shadow-[2px_2px_0px_0px_#020617]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                          {formatDate(p.due_date)}
                        </span>
                        <span className="text-[11px] font-black text-slate-900 tabular-nums dark:text-slate-200">
                          ₱{p.amount.toLocaleString()}
                        </span>
                        {p.amount_due > p.amount && (
                          <span className="text-[10px] text-slate-400">
                            of ₱{p.amount_due.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <span className="rounded-md border-2 border-slate-900 bg-purple-100 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-purple-700 uppercase shadow-[1px_1px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-purple-800 dark:text-purple-100 dark:shadow-[1px_1px_0px_0px_#020617]">
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
            className="mt-3 overflow-hidden rounded-xl border-2 border-red-500
              bg-red-50 shadow-[3px_3px_0px_0px_#ef4444] dark:border-[#020617]
              dark:bg-red-900 dark:shadow-[3px_3px_0px_0px_#020617]"
          >
            <button
              type="button"
              data-prevent-account-open
              onClick={() => setOverdueExpanded((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2"
            >
              <div
                className="flex size-5 shrink-0 items-center justify-center
                  rounded-full border border-slate-900 bg-red-500 text-[10px]
                  font-black text-white dark:border-[#020617]"
              >
                {overdueCount}
              </div>
              <span
                className="text-[11px] font-bold text-red-700 dark:text-red-100"
              >
                overdue
              </span>
              <span
                className="ml-auto text-[11px] font-black text-red-800
                  tabular-nums dark:text-red-100"
              >
                ₱{overdueTotal.toLocaleString()}
              </span>
              <ChevronDown
                className={`size-3.5 text-red-500 transition-transform
                dark:text-red-200 ${overdueExpanded ? "rotate-180" : ""}`}
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
            className={`flex size-5 items-center justify-center rounded border-2
              transition-colors ${
                selected
                  ? `border-slate-900 bg-slate-900 dark:border-[#020617]
                    dark:bg-amber-400`
                  : `dark:bg-card border-slate-300 bg-white
                    dark:border-[#020617]`
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
