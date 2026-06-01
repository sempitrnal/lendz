import { ChevronDown } from "lucide-react";
import { useState, SyntheticEvent } from "react";
import AccountCardMenu from "./account-card-menu";
import { AccountRow, AccountComputedMetrics } from "./borrower-accounts-section";

export function AccountCard({
  account,
  isOpening,
  onOpen,
  onPrefetch,
  onEdit,
  onActivate,
  metrics,

}: {
  account: AccountRow;
  isOpening: boolean;
  onOpen: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onEdit: (account: AccountRow) => void;
  onActivate?: (account: AccountRow) => void;
  metrics?: AccountComputedMetrics;
}) {
  const amountLeftToPay = metrics?.amountLeftToPay ?? 0;
  const profitToMake = metrics?.profitToMake ?? 0;
  const totalDue = metrics?.totalDue ?? 0;
  const totalPaid = metrics?.totalPaid ?? 0;
  const progressPct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
  const nextCollectionDate = metrics?.nextCollectionDate;
  const nextCollectionAmount = metrics?.nextCollectionAmount ?? 0;
  const nextCollectionAmountDue = metrics?.nextCollectionAmountDue ?? 0;
  const nextCollectionStatus = metrics?.nextCollectionStatus ?? null;
  const overdueCount = metrics?.overdueCount ?? 0;
  const overdueTotal = metrics?.overdueTotal ?? 0;
  const [overdueExpanded, setOverdueExpanded] = useState(overdueCount <= 6);
  const isManual = account.schedule_mode === "manual";
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
    if (
      (e.target as HTMLElement).closest("[data-prevent-account-open]")
    ) {
      return;
    }
    onOpen(account.id);
  }

  const isCashAdvance = account.type === "cash_advance";
  const accentStrip = isCashAdvance ? "bg-amber-400" : "bg-violet-500";
  const badgeBg = isCashAdvance ? "bg-amber-200 text-amber-900" : "bg-violet-200 text-violet-900";
  const hasOverdue = overdueCount > 0;

  return (
    <div
      className={`relative overflow-hidden  rounded-xl border-2 bg-solar transition-all duration-150 dark:bg-card ${
        hasOverdue ? "border-red-700 shadow-[4px_4px_0px_0px_#b91c1c]" : "border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] dark:border-border"
      } ${
        isOpening
          ? "scale-[0.98] opacity-60"
          : "hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#0f172a]"
      }`}
    >
      {/* Left accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentStrip}`} />

      <div
        role="button"
        tabIndex={isOpening ? -1 : 0}
        onPointerEnter={() => onPrefetch?.(account.id)}
        onClick={tryOpenAccount}
        onKeyDown={(e) => {
          if (isOpening) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          if ((e.target as HTMLElement).closest("[data-prevent-account-open]")) return;
          e.preventDefault();
          onOpen(account.id);
        }}
        aria-disabled={isOpening}
        aria-busy={isOpening}
        aria-label="Open account"
        className="min-w-0 w-full cursor-pointer pl-4 pr-10 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-border"
      >
        {/* Row 1: type badge + principal + status */}
        <div className="flex items-center gap-1.5">
          {/* <span className={`shrink-0 text-[9px] font-black uppercase border border-slate-900 px-1.5 py-0.5 ${badgeBg}`}>
            {isCashAdvance ? "ca" : "loan"}
          </span> */}
          <span className="text-lg font-black tabular-nums leading-none text-slate-900 dark:text-foreground">
            ₱{Number(account.principal_amount ?? 0).toLocaleString()}
          </span>
          <span className={`ml-auto shrink-0 text-[9px] font-black uppercase border border-slate-900 px-1.5 py-0.5 rounded-full dark:border-border ${
            account.status === "active" ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-200" : account.status === "pending" ? "bg-amber-200 text-amber-900 dark:bg-amber-800/50 dark:text-amber-200" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}>
            {account.status}
          </span>
        </div>

        {/* Row 2: meta */}
        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-muted-foreground">
          {!isManual && account.status !== "pending" ? `${account.payment_frequency} · ${account.term_months}mo · ` : account.status === "pending" ? "pending · " : "manual · "}
          {account.interest_rate}%
          {account.release_date && ` · ${new Date(account.release_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
        </p>

        {account.status === "pending" && onActivate && (
          <button
            type="button"
            data-prevent-account-open
            onClick={() => onActivate(account)}
            className="mt-2 inline-flex items-center rounded-lg border-2 border-slate-900 bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none dark:border-border dark:bg-emerald-700/50 dark:text-emerald-100"
          >
            activate account
          </button>
        )}

        {/* Row 3: stats — hidden when pending */}
        {account.status !== "pending" && (
          <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-muted-foreground">
            <span>Remaining </span><strong className="font-black text-red-700 dark:text-red-400">₱{amountLeftToPay.toLocaleString()}</strong>
            {isManual ? (
              <><span className="text-slate-300 dark:text-border"> · </span><span>Paid </span><strong className="font-black text-slate-900 dark:text-foreground">₱{totalPaid.toLocaleString()}</strong></>
            ) : (
              <><span className="text-slate-300 dark:text-border"> · </span><span>Collected </span><strong className="font-black text-green-700 dark:text-green-400">₱{totalPaid.toLocaleString()}</strong><span className="text-slate-300 dark:text-border"> · </span><span>Profit </span><strong className="font-black text-slate-900 dark:text-foreground">₱{Math.round(profitToMake).toLocaleString()}</strong><span className="text-slate-300 dark:text-border"> · </span><strong className="font-black text-slate-900 dark:text-foreground">₱{Math.round(profitToMake / perPayrollDivisor).toLocaleString()}</strong><span>/pay</span></>
            )}
          </p>
        )}

        {/* Row 4: next collection */}
        {!isManual && nextCollectionDate && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] leading-snug text-slate-500 dark:text-muted-foreground">
            <span>Next </span>
            <strong className="font-black text-slate-900 dark:text-foreground">{new Date(nextCollectionDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong>
            <strong className="font-black tabular-nums text-slate-700 dark:text-foreground">₱{nextCollectionAmount.toLocaleString()}</strong>
            {nextCollectionStatus === "partial" && nextCollectionAmountDue > nextCollectionAmount && (
              <span className="text-slate-400 dark:text-muted-foreground">of ₱{nextCollectionAmountDue.toLocaleString()}</span>
            )}
            {nextCollectionStatus && (
              <span className={`text-[7px] font-black px-1 py-0.5 border border-slate-900 dark:border-border uppercase ${
                nextCollectionStatus === "overdue" ? "bg-red-300 text-red-900 dark:bg-red-700/50 dark:text-red-200"
                  : nextCollectionStatus === "paid" ? "bg-emerald-300 text-emerald-900 dark:bg-emerald-700/50 dark:text-emerald-200"
                  : nextCollectionStatus === "pending" ? "bg-yellow-300 text-yellow-900 dark:bg-yellow-700/50 dark:text-yellow-200"
                  : nextCollectionStatus === "partial" ? "bg-purple-300 text-purple-900 dark:bg-purple-700/50 dark:text-purple-200"
                  : "bg-blue-300 text-blue-900 dark:bg-blue-700/50 dark:text-blue-200"
              }`}>{nextCollectionStatus}</span>
            )}
          </p>
        )}

        {/* Overdue */}
        {hasOverdue && (
          <div className="mt-3 bg-red-100 p-1 rounded-sm border-red-400 border dark:border-red-800 dark:bg-red-900/30">
            <button
              type="button"
              data-prevent-account-open
              onClick={() => setOverdueExpanded((v) => !v)}
              className="flex w-full items-center gap-1 text-[11px]"
            >
              <span className="font-black text-red-600 dark:text-red-300">⚠ {overdueCount} overdue</span>
              <span className="font-black tabular-nums text-red-800 dark:text-red-300">₱{overdueTotal.toLocaleString()}</span>
              <ChevronDown className={`ml-auto size-3 text-red-600 dark:text-red-400 transition-transform duration-200 ${overdueExpanded ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-200 ${overdueExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="mt-0.5 space-y-0.5 pl-1">
                  {(metrics?.overdueSchedules ?? []).map((os, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-600 dark:text-muted-foreground">{new Date(os.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="font-black text-red-700 dark:text-red-300">₱{os.amount.toLocaleString()}</span>
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
            <div className="h-1 flex-1 overflow-hidden bg-slate-100 dark:bg-muted" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="shrink-0 text-[9px] tabular-nums text-slate-400 dark:text-muted-foreground">{progressPct}%</span>
          </div>
        )}
      </div>

      <div className="absolute right-3 top-3" data-prevent-account-open>
        <AccountCardMenu accountId={account.id} onEdit={() => onEdit(account)} />
      </div>
    </div>
  );
}