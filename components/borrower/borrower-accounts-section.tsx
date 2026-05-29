"use client";

import { FaPlus } from "react-icons/fa6";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Modal from "@/components/modal";
import AccountForm, {
  accountRowToFormInitial,
  type AccountEditableRow,
} from "@/components/forms/account-form";
import AccountCardMenu from "@/components/borrower/account-card-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { BorrowerSummary } from "./borrower-detail-view";
import { supabase } from "@/lib/supabase/client";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import NotesCanvas from "./notes-canvas";
import NeobrutButton from "../neobrut-button";
import BorrowerDetailMenu from "./borrower-detail-menu";
import { isDarkColor } from "@/lib/utils";

function StickyBorrowerStrip({
  borrower,
  totalLoaned,
  totalExpected,
  totalCollected,
  totalAmountCollected,
  totalRemaining,
  profitPerSchedule,
  collectedPct,
}: {
  borrower: BorrowerSummary | undefined;
  totalLoaned: number;
  totalExpected: number;
  totalCollected: number;
  totalAmountCollected: number;
  totalRemaining: number;
  profitPerSchedule: number;
  collectedPct: number;
}) {
  const [open, setOpen] = useState(false);
  if (!borrower) return null;
  return (
    <div className="sticky top-10 z-30 -mx-4 bg-white/95 backdrop-blur  relative">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black uppercase tracking-wide text-slate-900">
              {borrower.first_name} {borrower.last_name}
            </p>
            {borrower.category && borrower.category.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {borrower.category.map((c) => (
                  <span
                    key={c.id}
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-900/30 ${isDarkColor(c.color) ? "text-white" : "text-slate-900"}`}
                    style={{ backgroundColor: c.color }}
                  >{c.name}</span>
                ))}
              </div>
            )}
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              <span>Loaned <strong className="text-slate-700">₱{Math.round(totalLoaned).toLocaleString()}</strong></span>
              <span>Collected <strong className="text-emerald-700">₱{Math.round(totalAmountCollected).toLocaleString()}</strong></span>
              <span>Remaining <strong className="text-rose-700">₱{Math.round(totalRemaining).toLocaleString()}</strong></span>
            </div>
          </div>
          <ChevronDown className={`ml-1 size-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        <div className="ml-2 shrink-0" data-prevent-strip-open>
          <BorrowerDetailMenu borrowerId={borrower.id} />
        </div>
      </div>
      <div className={`absolute left-0 right-0 top-full z-30 grid overflow-hidden bg-white/95 backdrop-blur shadow-[0_4px_0_0_#0f172a] transition-[grid-template-rows] duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {([
                { label: "Total Loaned",      value: totalLoaned,             bg: "bg-sky-100" },
                { label: "Money Collected",   value: totalAmountCollected,    bg: "bg-teal-100" },
                { label: "Remaining",         value: totalRemaining,          bg: "bg-rose-100" },
                { label: "Profit Expected",   value: totalExpected,           bg: "bg-amber-100" },
                { label: "Profit Collected",  value: totalCollected,          bg: "bg-emerald-100" },
                { label: "Profit / Schedule", value: profitPerSchedule,       bg: "bg-violet-100" },
              ] as const).map(({ label, value, bg }, i) => (
                <div
                  key={label}
                  className={`border-2 border-slate-900 ${bg} px-2 py-1.5 shadow-[2px_2px_0px_0px_#0f172a] transition-all duration-200 ${open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
                  style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
                >
                  <p className="font-black uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-0.5 font-black tabular-nums text-slate-900">₱{Math.round(value).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className={`mt-2 flex items-center gap-2 transition-all duration-200 ${open ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: open ? "160ms" : "0ms" }}>
              <div className="h-2 flex-1 overflow-hidden rounded-sm border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]">
                <div className="h-full bg-emerald-400 transition-[width] duration-500 ease-out" style={{ width: open ? `${collectedPct}%` : "0%" }} />
              </div>
              <span className="shrink-0 text-[10px] font-black tabular-nums text-slate-700">{collectedPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export type AccountRow = AccountEditableRow & {
  id: string;
  borrower_id: string;
  status: string;
};
type PaymentScheduleLite = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  status: string;
};

export type AccountComputedMetrics = {
  amountLeftToPay: number;
  profitToMake: number;
  nextCollectionDate: string | null;
  nextCollectionAmount: number;
  nextCollectionAmountDue: number;
  nextCollectionStatus: string | null;
  nextUnpaidScheduleId: string | null;
  overdueCount: number;
  overdueTotal: number;
  overdueSchedules: { due_date: string; amount: number }[];
  totalDue: number;
  totalPaid: number;
  term_months?: string| number| null;
  term_installments?: string| number| null;
  schedule_mode?: string | null;
};

type BorrowerAccountsSectionProps = {
  borrowerId: string;
  accounts: AccountRow[] | null;
  borrower?: BorrowerSummary;
  initialMetrics?: Record<string, AccountComputedMetrics>;
};
function AccountCard({
  account,
  isOpening,
  onOpen,
  onEdit,
  metrics,

}: {
  account: AccountRow;
  isOpening: boolean;
  onOpen: (id: string) => void;
  onEdit: (account: AccountRow) => void;
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
      className={`relative overflow-hidden rounded-xl border-2 bg-white transition-all duration-150 ${
        hasOverdue ? "border-red-700 shadow-[4px_4px_0px_0px_#b91c1c]" : "border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
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
        className="min-w-0 w-full cursor-pointer pl-4 pr-10 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        {/* Row 1: type badge + principal + status */}
        <div className="flex items-center gap-1.5">
          {/* <span className={`shrink-0 text-[9px] font-black uppercase border border-slate-900 px-1.5 py-0.5 ${badgeBg}`}>
            {isCashAdvance ? "ca" : "loan"}
          </span> */}
          <span className="text-lg font-black tabular-nums leading-none text-slate-900">
            ₱{Number(account.principal_amount ?? 0).toLocaleString()}
          </span>
          <span className={`ml-auto shrink-0 text-[9px] font-black uppercase border border-slate-900 px-1.5 py-0.5 rounded-full ${
            account.status === "active" ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-600"
          }`}>
            {account.status}
          </span>
        </div>

        {/* Row 2: meta */}
        <p className="mt-0.5 text-[10px] text-slate-400">
          {!isManual ? `${account.payment_frequency} · ${account.term_months}mo · ` : "manual · "}
          {account.interest_rate}%
          {account.release_date && ` · ${new Date(account.release_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
        </p>

        {/* Row 3: stats */}
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          <span>Remaining </span><strong className="font-black  text-red-700">₱{amountLeftToPay.toLocaleString()}</strong>
          {isManual ? (
            <><span className="text-slate-300"> · </span><span>Paid </span><strong className="font-black text-slate-900">₱{totalPaid.toLocaleString()}</strong></>
          ) : (
            <><span className="text-slate-300"> · </span><span>Collected </span><strong className="font-black text-green-700">₱{totalPaid.toLocaleString()}</strong><span className="text-slate-300"> · </span><span>Profit </span><strong className="font-black text-slate-900">₱{Math.round(profitToMake).toLocaleString()}</strong><span className="text-slate-300"> · </span><strong className="font-black text-slate-900">₱{Math.round(profitToMake / perPayrollDivisor).toLocaleString()}</strong><span>/pay</span></>
          )}
        </p>

        {/* Row 4: next collection */}
        {!isManual && nextCollectionDate && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] leading-snug text-slate-500">
            <span>Next </span>
            <strong className="font-black text-slate-900">{new Date(nextCollectionDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong>
            <strong className="font-black tabular-nums text-slate-700">₱{nextCollectionAmount.toLocaleString()}</strong>
            {nextCollectionStatus === "partial" && nextCollectionAmountDue > nextCollectionAmount && (
              <span className="text-slate-400">of ₱{nextCollectionAmountDue.toLocaleString()}</span>
            )}
            {nextCollectionStatus && (
              <span className={`text-[7px] font-black px-1 py-0.5 border border-slate-900 uppercase ${
                nextCollectionStatus === "overdue" ? "bg-red-300 text-red-900"
                  : nextCollectionStatus === "paid" ? "bg-emerald-300 text-emerald-900"
                  : nextCollectionStatus === "pending" ? "bg-yellow-300 text-yellow-900"
                  : nextCollectionStatus === "partial" ? "bg-purple-300 text-purple-900"
                  : "bg-blue-300 text-blue-900"
              }`}>{nextCollectionStatus}</span>
            )}
          </p>
        )}

        {/* Overdue */}
        {hasOverdue && (
          <div className="mt-3  bg-red-100 p-1 rounded-sm border-red-400 border">
            <button
              type="button"
              data-prevent-account-open
              onClick={() => setOverdueExpanded((v) => !v)}
              className="flex w-full items-center gap-1 text-[11px]"
            >
              <span className="font-black text-red-600">⚠ {overdueCount} overdue</span>
              <span className="font-black tabular-nums text-red-800">₱{overdueTotal.toLocaleString()}</span>
              <ChevronDown className={`ml-auto size-3 text-red-600 transition-transform duration-200 ${overdueExpanded ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-200 ${overdueExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="mt-0.5 space-y-0.5 pl-1">
                  {(metrics?.overdueSchedules ?? []).map((os, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-600">{new Date(os.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="font-black text-red-700">₱{os.amount.toLocaleString()}</span>
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
            <div className="h-1 flex-1 overflow-hidden bg-slate-100" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="shrink-0 text-[9px] tabular-nums text-slate-400">{progressPct}%</span>
          </div>
        )}
      </div>

      <div className="absolute right-3 top-3" data-prevent-account-open>
        <AccountCardMenu accountId={account.id} onEdit={() => onEdit(account)} />
      </div>
    </div>
  );
}
export default function BorrowerAccountsSection({
  borrowerId,
  accounts,
  borrower,
  initialMetrics,
}: BorrowerAccountsSectionProps) {
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(
    null
  );
  const [openingAccountId, setOpeningAccountId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const [markingNextPaidScheduleId, setMarkingNextPaidScheduleId] = useState<
    string | null
  >(null);
  const editorRef = useRef<any>(null);
  const router = useRouter();
  const [notes, setNotes] = useState<any[]>([]);
  const [accountMetricsById, setAccountMetricsById] = useState<
    Record<string, AccountComputedMetrics>
  >(initialMetrics ?? {});
  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from("borrower_notes")
      .select("*")
      .eq("borrower_id", borrowerId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setNotes(data || []);
  };
  const deleteNote = async (id: string) => {
    const confirmed = window.confirm(
      "Delete this note?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("borrower_notes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    setNotes((prev) =>
      prev.filter((n) => n.id !== id)
    );

    setIsNotesOpen(false);
    setSelectedNote(null);
  };
  const [selectedNote, setSelectedNote] =
    useState<any | null>(null);

  const [isNotesOpen, setIsNotesOpen] =
    useState(false);
  const handleOpenAccount = (id: string) => {
    setOpeningAccountId(id);
    router.push(`/accounts/${id}`);
  };


  const fetchAccountMetrics = async () => {
    if (!accounts || accounts.length === 0) {
      setAccountMetricsById({});
      return;
    }

    const accountIds = accounts.map((account) => account.id);
    const { data: schedulesData, error } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status"
      )
      .in("account_id", accountIds)
      .order("due_date", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const scheduleRows = (schedulesData ?? []) as PaymentScheduleLite[];
    const byAccount = new Map<string, PaymentScheduleLite[]>();
    scheduleRows.forEach((row) => {
      const prev = byAccount.get(row.account_id) ?? [];
      prev.push(row);
      byAccount.set(row.account_id, prev);
    });

    const computed: Record<string, AccountComputedMetrics> = {};
    accounts.forEach((account) => {
      console.log(account);
      const rows = byAccount.get(account.id) ?? [];
      const totalPayment = rows.reduce(
        (sum, row) => sum + Number(row.amount_due ?? 0),
        0
      );
      const amountPaid = rows.reduce(
        (sum, row) => sum + amountPaidOnInstallment(row),
        0
      );
      const amountLeftToPayRaw = rows.reduce(
        (sum, row) => sum + remainingOnInstallment(row),
        0
      );
      const amountLeftToPayRolling = rows
        .filter((row) => row.status !== "partial")
        .reduce((sum, row) => sum + remainingOnInstallment(row), 0);
      const principal = Number(account.principal_amount ?? 0);
      const interestRate = Number(account.interest_rate ?? 0);
      const isManual = account.schedule_mode === "manual";
      const isRolling = isManual && account.interest_type === "rolling";
      const isFlatManual = isManual && !isRolling;
      const manualFlatTotal = isFlatManual ? principal * (1 + interestRate / 100) : 0;
      const amountLeftToPay = isFlatManual
        ? Math.max(0, manualFlatTotal - amountPaid)
        : isRolling
          ? amountLeftToPayRolling
          : amountLeftToPayRaw;
      const rollingContract = isRolling ? amountPaid + amountLeftToPay : 0;
      const profitToMake = isFlatManual
        ? manualFlatTotal - principal
        : isRolling
          ? Math.max(0, rollingContract - principal)
          : Math.max(0, totalPayment - principal);
      const nextUnpaid = nextDueScheduleForCollection(rows);
      const overdueRows = rows.filter(
        (row) => row.status === "overdue" && !isInstallmentFullyPaid(row)
      );
      console.log(account);
      computed[account.id] = {
        amountLeftToPay,
        profitToMake,
        nextCollectionDate: nextUnpaid?.due_date ?? null,
        nextCollectionAmount: nextUnpaid ? remainingOnInstallment(nextUnpaid) : 0,
        nextCollectionAmountDue: nextUnpaid ? Math.max(0, Number(nextUnpaid.amount_due ?? 0)) : 0,
        nextCollectionStatus: nextUnpaid?.status ?? null,
        nextUnpaidScheduleId: nextUnpaid?.id ?? null,
        overdueCount: overdueRows.length,
        overdueTotal: overdueRows.reduce((sum, row) => sum + remainingOnInstallment(row), 0),
        overdueSchedules: [...overdueRows]
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .map((row) => ({ due_date: row.due_date, amount: remainingOnInstallment(row) })),
        totalDue: isFlatManual ? manualFlatTotal : totalPayment,
        totalPaid: amountPaid,
        term_months: account.term_months,
        term_installments: account.term_installments,
        schedule_mode: account.schedule_mode,
      };
    });

    setAccountMetricsById(computed);
  };

  useEffect(() => {
    fetchNotes();
    fetchAccountMetrics();
  }, [borrowerId, accounts]);

  const summaryStats = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    const totalLoaned = accounts.reduce((s, a) => s + Number(a.principal_amount ?? 0), 0);
    const metricsArr = Object.values(accountMetricsById);
    const totalExpected = metricsArr.reduce((s, m) => s + m.profitToMake, 0);
    const totalAmountCollected = metricsArr.reduce((s, m) => s + m.totalPaid, 0);
    const totalRemaining = metricsArr.reduce((s, m) => s + m.amountLeftToPay, 0);
    const totalCollected = metricsArr.reduce((s, m) =>
      s + (m.totalDue > 0 ? m.profitToMake * (m.totalPaid / m.totalDue) : 0), 0);
    let profitPerSchedule = 0;
    for (const a of accounts) {
      const m = accountMetricsById[a.id];
      if (!m) continue;
      const termMonths = Number(m.term_months) || 0;
      const freq = a.payment_frequency;
      const isManual = a.schedule_mode === "manual";
      const installments = isManual
        ? Number(m.term_installments) || termMonths || 1
        : freq === "custom"
          ? Number(m.term_installments) || 1
          : freq === "bimonthly"
            ? termMonths * 2 || 1
            : freq === "weekly"
              ? termMonths * 4 || 1
              : termMonths || 1;
      profitPerSchedule += m.profitToMake / installments;
    }
    const collectedPct = totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 0;
    return { totalLoaned, totalExpected, totalCollected, totalAmountCollected, totalRemaining, profitPerSchedule, collectedPct };
  }, [accounts, accountMetricsById]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="rounded-lg  ">
      {summaryStats && (
        <StickyBorrowerStrip
          borrower={borrower}
          totalLoaned={summaryStats.totalLoaned}
          totalExpected={summaryStats.totalExpected}
          totalCollected={summaryStats.totalCollected}
          totalAmountCollected={summaryStats.totalAmountCollected}
          totalRemaining={summaryStats.totalRemaining}
          profitPerSchedule={summaryStats.profitPerSchedule}
          collectedPct={summaryStats.collectedPct}
        />
      )}

   
      {!accounts || accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-gray-500">No accounts yet</p>
        </div>
      ) : (() => {
        const sortByRelease = (group: typeof accounts) =>
          [...group].sort((a, b) => {
            const da = a.release_date ? new Date(a.release_date).getTime() : 0;
            const db = b.release_date ? new Date(b.release_date).getTime() : 0;
            return db - da;
          });
        const loans = sortByRelease(accounts.filter((a) => a.type !== "cash_advance"));
        const cashAdvances = sortByRelease(accounts.filter((a) => a.type === "cash_advance"));
        const renderGroup = (group: typeof accounts, label: string, accent: string) =>
          group.length === 0 ? null : (
            <div>
              <div className="mb-3 flex items-center gap-2 mt-10">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] ${accent}`}>
                  {label}
                </span>
                <span className="text-xs font-semibold text-slate-400">{group.length} account{group.length === 1 ? "" : "s"}</span>
              </div>
              <div className="space-y-3">
                {group.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isOpening={openingAccountId === account.id}
                    onOpen={handleOpenAccount}
                    onEdit={(acc) => {
                      setEditingAccount(acc);
                      setIsAccountDialogOpen(true);
                    }}
                    metrics={accountMetricsById[account.id]}
                  />
                ))}
              </div>
            </div>
          );
        return (
          <div className="space-y-8">
            {renderGroup(loans, "loans", "bg-violet-200 text-violet-900")}
            {renderGroup(cashAdvances, "cash advances", "bg-amber-200 text-amber-900")}
          </div>
        );
      })()}

      {/* Speed-dial FAB — portalled to body to escape PageTransition transform stacking context */}
      {isMounted && createPortal(
        <div className="fixed bottom-[76px] right-4 z-[9999] flex flex-col items-end gap-2">
          {fabOpen && (
            <>
              <button
                type="button"
                onClick={() => { setFabOpen(false); setSelectedNote(null); setIsNotesOpen(true); }}
                className="flex items-center gap-2 rounded-full border-2 border-slate-900 bg-yellow-300 px-4 py-2.5 text-sm font-black shadow-[3px_3px_0px_0px_#0f172a] transition active:translate-y-px active:shadow-[1px_1px_0px_0px_#0f172a]"
              >
                <FaPlus className="size-3" /> note
              </button>
              <button
                type="button"
                onClick={() => { setFabOpen(false); setEditingAccount(null); setIsAccountDialogOpen(true); }}
                className="flex items-center gap-2 rounded-full border-2 border-slate-900 bg-emerald-300 px-4 py-2.5 text-sm font-black shadow-[3px_3px_0px_0px_#0f172a] transition active:translate-y-px active:shadow-[1px_1px_0px_0px_#0f172a]"
              >
                <FaPlus className="size-3" /> loan
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setFabOpen((v) => !v)}
            aria-label={fabOpen ? "Close actions" : "Open actions"}
            className={`flex size-14 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-900 text-white shadow-[3px_3px_0px_0px_rgb(15_23_42/0.4)] transition-transform duration-200 active:scale-95 ${fabOpen ? "rotate-45" : ""}`}
          >
            <FaPlus className="size-5" />
          </button>
        </div>,
        document.body
      )}

      <Dialog
        open={isAccountDialogOpen}
        onOpenChange={(open) => {
          setIsAccountDialogOpen(open);
          if (!open) setEditingAccount(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "edit account" : "add account"}
            </DialogTitle>
          </DialogHeader>

          <AccountForm
            key={`${borrowerId}-${editingAccount?.id ?? "new"}`}
            borrowerId={borrowerId}
            accountId={editingAccount?.id}
            initialValues={
              editingAccount
                ? accountRowToFormInitial(editingAccount)
                : undefined
            }
            onSuccess={() => {
              setIsAccountDialogOpen(false);
              setEditingAccount(null);
            }}
          />
        </DialogContent>
      </Dialog>
      {/* <NotesCanvas borrowerId={borrowerId} initialData={borrower?.notes_canvas} /> */}
      <div className="mt-10">
       {notes.length === 0 ? null : (
        <div className="mb-4">
          <h2 className="text-xl font-black uppercase">Notes</h2>
        </div>
       )}

        <div
          className="
    w-full
    "
        >
          {notes.map((note, i) => (
            <button
              key={note.id}
              onClick={() => {
                setSelectedNote(note);
                setIsNotesOpen(true);
              }}
              style={{
                // left: note.x,
                // top: note.y,
                // rotate: `${i % 2 === 0 ? -2 : 2}deg`,
              }}
              className="
          overflow-hidden
          rounded-sm
          w-full
          p-3
          
          shadow-md
          transition
          hover:scale-[1.02]
        "
            >
              {note.preview_img_url ? (
                <img
                  src={note.preview_img_url}
                  className="pointer-events-none rounded w-full"
                />
              ) : (
                <div className="h-20" />
              )}
            </button>
          ))}
        </div>
      </div>

      <Dialog
        open={isNotesOpen}
        onOpenChange={setIsNotesOpen}
      >
        <DialogContent className="top-0 translate-y-0 h-[100svh] max-h-[100svh] max-w-full rounded-none sm:top-1/2 sm:-translate-y-1/2 sm:h-auto sm:max-h-[95svh] sm:max-w-5xl sm:rounded-xl">
          <div className="flex items-center justify-between mt-10">
            <DialogHeader className="">
              <DialogTitle>
                {selectedNote
                  ? "Edit note"
                  : "New note"}
              </DialogTitle>
            </DialogHeader>

            {selectedNote && (
              <button
                onClick={() =>
                  deleteNote(selectedNote.id)
                }
                className="
        rounded-md
        border
        border-red-200
        bg-red-50
        px-3
        py-1
        text-sm
        text-red-600
        hover:bg-red-100
      "
              >
                Delete
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <NotesCanvas
            borrowerId={borrowerId}
            note={selectedNote}
            onSaved={(newNote) => {
              if (selectedNote) {
                setNotes((prev) =>
                  prev.map((n) =>
                    n.id === newNote.id ? newNote : n
                  )
                );
              } else {
                setNotes((prev) => [...prev, newNote]);
              }

              setIsNotesOpen(false);
            }}
          />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
