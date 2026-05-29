"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useRef, type SyntheticEvent } from "react";
import { isDarkColor } from "@/lib/utils";
import { ChevronDown, Loader2, Phone } from "lucide-react";
import Link from "next/link";

import BorrowerDetailMenu from "@/components/borrower/borrower-detail-menu";
import { Borrower } from "./borrower-list";

type BorrowerCardProps = {
  borrower: Borrower;
  quickAction?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
  /** Borrowers list: next collection, mark next paid, overflow menu */
  showScheduleSummary?: boolean;
  onBorrowerUpdated?: () => void;

};

export function BorrowerCard({
  borrower,
  quickAction,
  showScheduleSummary = false,
  onBorrowerUpdated,

}: BorrowerCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAccountPending, startAccountTransition] = useTransition();
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const touchStartY = useRef(0);
  const didScroll = useRef(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [expandedOverdue, setExpandedOverdue] = useState<Record<number, boolean>>({});
  const toggleOverdue = (i: number, defaultOpen: boolean) =>
    setExpandedOverdue((prev) => ({ ...prev, [i]: !(prev[i] ?? defaultOpen) }));
  const categories = [...(borrower.borrower_categories ?? [])].sort((a, b) =>
    a.category.name.localeCompare(b.category.name)
  );

  const hasOverdue = (borrower.overdue_count ?? 0) > 0;
  const hasAccounts = borrower.has_accounts === true;
  const accountsCount = borrower.accounts_count ?? 0;
  const nextDate = borrower.next_collection_date;
  const nextAmount = borrower.next_collection_amount ?? 0;
  const nextAmounts = borrower.next_collection_amounts;
  const nextStatus = borrower.next_collection_status;
  const hasNextUnpaid = Boolean(nextDate);
  const schedules = borrower.account_schedules || [];
  const manualPrincipal = borrower.manual_total_principal ?? 0;
  const manualPaid = borrower.manual_total_paid ?? 0;
  const manualRemaining = borrower.manual_total_remaining ?? 0;
  const hasManual = manualPrincipal > 0;
  const manualAccountsCount = borrower.manual_accounts_count ?? 0;
  const hasAutoAccounts = (borrower.accounts_count ?? 0) > manualAccountsCount;
  function openBorrower(e: SyntheticEvent) {
    if (isPending) return;
    if (didScroll.current) return;
    if (
      (e.target as HTMLElement).closest("[data-prevent-borrower-card-open]")
    ) {
      return;
    }
    startTransition(() => {
      router.push(`/borrowers/${borrower.id}`);
    });
  }

  return (
    <div
      onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; didScroll.current = false; }}
      onTouchMove={(e) => { if (Math.abs(e.touches[0].clientY - touchStartY.current) > 8) didScroll.current = true; }}
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border-2 bg-white text-left transition-all duration-150 ${
        hasOverdue
          ? "border-red-700 shadow-[4px_4px_0px_0px_#b91c1c]"
          : "border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
      } ${isPending ? "" : " active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#0f172a]"}`}
      aria-busy={isPending}
    >

      <div
        className="absolute right-2 top-2 z-10 flex items-center gap-1"
        data-prevent-borrower-card-open
      >
        {borrower.contact ? (
          <Link
            href={`tel:${borrower.contact}`}
            className="touch-manipulation rounded border-2 border-slate-900 bg-indigo-100 p-1.5 text-indigo-700 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-indigo-200 active:shadow-none active:translate-y-px"
            aria-label={`Call ${borrower.first_name} ${borrower.last_name}`}
          >
            <Phone className="size-3.5" />
          </Link>
        ) : null}
        <BorrowerDetailMenu
          borrowerId={borrower.id}
          onDeleted={showScheduleSummary ? onBorrowerUpdated : undefined}
        />
      </div>

      <div
        role="button"
        tabIndex={isPending ? -1 : 0}
        onClick={openBorrower}
        onKeyDown={(e) => {
          if (isPending) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          startTransition(() => {
            router.push(`/borrowers/${borrower.id}`);
          });
        }}
        aria-disabled={isPending}
        className={`box-border block w-full min-w-0 max-w-full touch-manipulation cursor-pointer p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${isPending ? "opacity-50" : ""}`}
        aria-label={`Open ${borrower.first_name} ${borrower.last_name}`}
      >
        <div className="flex w-full min-w-0 flex-col">
          <h2 className="text-xl pr-4 font-black uppercase text-slate-900">
            {borrower.first_name} {borrower.last_name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((e: { category: { id: string; color: string | null; name: string } }) => {
              const { id, color, name } = e.category;
              return (
                <div
                  key={id}
                  className="flex items-center rounded-md border border-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#1e293b]"
                  style={{
                    backgroundColor: color ?? "#333",
                    color: isDarkColor(color ?? "333") ? "white" : "#1e1a4d",
                  }}
                >
                  {name}
                </div>
              );
            })}
          </div>
        </div>

        {showScheduleSummary && hasManual ? (
          <div
            className="mt-4 w-full min-w-0 border-2 border-slate-900 bg-violet-50 p-3 shadow-[2px_2px_0px_0px_#0f172a]"
          >
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Manual accounts
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <div className="rounded-md border-2 border-slate-900 bg-white p-2 shadow-[1px_1px_0px_0px_#0f172a]">
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Principal</p>
                <p className="mt-0.5 text-sm font-black tabular-nums text-slate-900">₱{manualPrincipal.toLocaleString()}</p>
              </div>
              <div className="rounded-md border-2 border-slate-900 bg-emerald-50 p-2 shadow-[1px_1px_0px_0px_#0f172a]">
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Paid</p>
                <p className="mt-0.5 text-sm font-black tabular-nums text-emerald-800">₱{manualPaid.toLocaleString()}</p>
              </div>
              <div className="rounded-md border-2 border-slate-900 bg-rose-50 p-2 shadow-[1px_1px_0px_0px_#0f172a]">
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Remaining</p>
                <p className="mt-0.5 text-sm font-black tabular-nums text-rose-800">₱{manualRemaining.toLocaleString()}</p>
              </div>
            </div>

            {manualPrincipal > 0 && (() => {
              const pct = Math.min(100, Math.round((manualPaid / manualPrincipal) * 100));
              return (
                <div className="mt-2 space-y-1">
                  <div
                    className="h-2 w-full overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Manual payment progress"
                  >
                    <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] font-black text-stone-700">{pct}% paid</p>
                </div>
              );
            })()}
          </div>
        ) : null}

        {showScheduleSummary && hasAccounts && hasAutoAccounts ? (
          <div
            className="mt-4 w-full min-w-0 self-stretch border-2 border-slate-900 bg-sky-100 p-3 shadow-[2px_2px_0px_0px_#0f172a]"
          >
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Next collection
                  {accountsCount > 0 ? (
                    <span className="ml-1 normal-case text-slate-400">
                      · {accountsCount} account{accountsCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </p>
                {hasNextUnpaid ? (
                  <div className="mt-2 space-y-1.5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        
                      </p>
                   {schedules ? schedules.map((schedule,i) => {
                    const isThisAccountPending = isAccountPending && pendingAccountId === schedule.account_id;
                    return (
                    <button
                      key={i}
                      type="button"
                      data-prevent-borrower-card-open
                      className="relative block w-full touch-manipulation rounded-lg text-left transition hover:bg-black/5 -mx-1 px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (didScroll.current) return;
                        if (!schedule.account_id) return;
                        setPendingAccountId(schedule.account_id);
                        startAccountTransition(() => {
                          router.push(`/accounts/${schedule.account_id}`);
                        });
                      }}
                    >
                    <div className="flex flex-col gap-2">
                       <p className="text-sm mt-2 font-black text-slate-900 flex  items-center gap-2">
                       {new Date(schedule.due_date).toLocaleDateString(undefined, {
                         month: "short",
                         day: "numeric",
                         year: "numeric",
                       })}
                       {schedules.length > 1 ? (
                         <span className="font-bold text-stone-500 text-xs w-max">
                           ₱{schedule.amount.toLocaleString()}
                           {schedule.status === "partial" && schedule.amount_due_per_schedule && schedule.amount_due_per_schedule > schedule.amount ? (
                             <span className="font-normal text-slate-400"> of ₱{Number(schedule.amount_due_per_schedule).toLocaleString()}</span>
                           ) : null}
                         </span>
                       ) : null}
                       {schedule.status ? (
                         <span className={`ml-1 text-[8px]  font-black text-black px-1 shadow-[2px_2px_0px_0px_#333] rounded-xs border border-slate-900   uppercase ${schedule.status === "overdue" ? "bg-red-500/70" : schedule.status === "paid" ? "bg-green-500/70" : schedule.status === "pending" ? "bg-yellow-500/70" : schedule.status === "partial" ? "bg-purple-500/70" : "bg-blue-500/70"}`}>
                           {schedule.status}
                         </span>
                       ) : null}
                     </p>  <div className="flex flex-col gap-2 items-start">
                      {(() => {
                        const isManual = schedule.schedule_mode === "manual";
                        const principal = Number(schedule.principal_amount ?? 0);
                        const totalSched = schedule.total_schedules || 1;
                        const amtDue = Number(schedule.amount_due_per_schedule ?? 0);
                        const isPartial = schedule.status === "partial";
                        const partialPaid = isPartial && amtDue > 0 ? amtDue - schedule.amount : 0;
                        const partialFraction = isPartial && amtDue > 0 ? partialPaid / amtDue : 0;
                        const pct = isManual
                          ? Math.min(100, Math.round(((schedule.amount_paid_total ?? 0) / (principal || 1)) * 100))
                          : Math.min(100, Math.round((((schedule.paid_schedules_count ?? 0) + partialFraction) / totalSched) * 100));
                        const principalPerSched = principal / totalSched;
                        const interestPerSched = amtDue > 0 ? amtDue - principalPerSched : null;
                        return (
                          <>
                            <div
                              className="h-2 md:w-40 w-full overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]"
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label="Payment progress"
                            >
                              <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="font-black text-stone-800 text-xs">
                              {isManual
                                ? `₱${(schedule.amount_paid_total ?? 0).toLocaleString()} paid of ₱${principal.toLocaleString()}`
                                : isPartial
                                  ? `${schedule.paid_schedules_count} paid · ₱${partialPaid.toLocaleString()} of ₱${amtDue.toLocaleString()} on current`
                                  : `${schedule.paid_schedules_count} paid out of ${schedule.total_schedules} schedule${schedule.total_schedules === 1 ? '' : 's'}`}
                            </p>
                            {!isManual && principal > 0 && (
                              <div className="flex flex-wrap gap-3 gap-y-1 mt-0.5">
                                <span className="text-[10px] text-slate-500">
                                  <span className="font-black text-slate-700">Principal</span> ₱{principal.toLocaleString()}
                                </span>
                                {schedule.interest_rate != null && (
                                  <span className="text-[10px] text-slate-500">
                                    <span className="font-black text-slate-700">Interest</span> {schedule.interest_rate}%
                                  </span>
                                )}
                                {interestPerSched != null && interestPerSched > 0 && (
                                  <span className="text-[10px] text-slate-500">
                                    <span className="font-black text-slate-700">per payroll</span> ₱{interestPerSched.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            )}
                            {schedule.overdue_schedules && schedule.overdue_schedules.length > 0 && (() => {
                              const defaultOpen = schedule.overdue_schedules.length <= 6;
                              const isOpen = expandedOverdue[i] ?? defaultOpen;
                              return (
                                <div className="mt-1 w-full rounded-md border-2 border-red-900 bg-red-50/80 px-2 py-1.5">
                                  <button
                                    type="button"
                                    data-prevent-borrower-card-open
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleOverdue(i, defaultOpen); }}
                                    className="flex w-full items-center justify-between gap-2"
                                  >
                                    <span className="text-[9px] font-black uppercase tracking-wide text-red-700">
                                      Overdue installments · {schedule.overdue_schedules.length}
                                    </span>
                                    <ChevronDown className={`size-3 text-red-600 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  <div className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                    <div className="overflow-hidden">
                                      <div className="space-y-0.5 mt-1">
                                        {schedule.overdue_schedules.map((os, oi) => (
                                          <div key={oi} className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-semibold text-slate-700">
                                              {new Date(os.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                            <span className="text-[10px] font-black text-red-700">₱{os.amount.toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        );
                      })()}
                  
                     </div>
                  <div className="h-px bg-slate-800 my-2" />

                    </div>
                      {isThisAccountPending && (
                        <div className="pointer-events-none absolute inset-0 rounded-lg bg-white/60 flex items-center justify-center">
                          <Loader2 className="size-4 animate-spin text-slate-500" />
                        </div>
                      )}
                    </button>
                    );
                   }) : null}

                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        total amount
                      </p>
                      <p className="text-sm font-black tabular-nums text-slate-900">
                        {`₱${nextAmount.toLocaleString()}`}
                        {schedules.length === 1 && schedules[0].status === "partial" && schedules[0].amount_due_per_schedule && schedules[0].amount_due_per_schedule > nextAmount ? (
                          <span className="ml-1 text-xs font-normal text-slate-400">of ₱{Number(schedules[0].amount_due_per_schedule).toLocaleString()}</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    All schedules paid
                  </p>
                )}
              </div>

       
            </div>
          </div>
        ) : null}
       {/* {borrower.overdue_total && borrower.overdue_count ? (
                <div className="min-w-0 mt-2 shadow-md border-2 border-red-900 bg-red-50 rounded-lg" data-prevent-borrower-card-open>
                  <button
                    type="button"
                    onClick={() => setOverdueOpen((o) => !o)}
                    className="w-full flex items-center justify-between p-2 text-left"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Overdue · {borrower.overdue_count} due date{borrower.overdue_count === 1 ? "" : "s"} · ₱{borrower.overdue_total?.toLocaleString()}
                    </p>
                    <span className={`text-[10px] font-black text-red-700 transition-transform ${overdueOpen ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {overdueOpen ? (
                    <div className="px-2 pb-2">
                      <div className="space-y-1">
                        {(borrower.overdue_schedules ?? []).map((s, i) => (
                          <p key={i} className="text-sm font-black text-slate-900 flex items-center gap-2">
                            {new Date(s.due_date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            <span className="font-bold text-stone-500 text-xs w-max">
                              ₱{s.amount.toLocaleString()}
                            </span>
                            <span className="text-[8px] font-black text-black px-1 shadow-[2px_2px_0px_0px_#333] rounded-xs border border-slate-900 uppercase bg-red-500/70">
                              overdue
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null} */}

        {!showScheduleSummary && quickAction ? (
          <div
            className="mt-4 flex justify-end"
            data-prevent-borrower-card-open
          >
            <button
              type="button"
              disabled={quickAction.isLoading || isPending}
              onClick={(e) => {
                e.stopPropagation();
                quickAction.onClick();
              }}
              className="rounded-md border-2 border-slate-900 bg-emerald-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-900 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
            >
              {quickAction.isLoading ? "Updating..." : quickAction.label}
            </button>
          </div>
        ) : null}

        {isPending ? (
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-white/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : null}
      </div>
    </div >
  );
}
