"use client";

import { FaPlus } from "react-icons/fa6";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
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
      if(freq === 'custom'){
        console.log(metrics?.term_installments)
        console.log(perPayrollDivisor)
      }
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
  const cardAccent = isCashAdvance
    ? "from-amber-50 via-white to-orange-50"
    : "from-violet-50 via-white to-fuchsia-50";
  const cardAccentHover = isCashAdvance
    ? "hover:from-amber-100 hover:to-orange-100"
    : "hover:from-violet-100 hover:to-fuchsia-100";
  const badgeBg = isCashAdvance ? "bg-amber-200 text-amber-900" : "bg-violet-200 text-violet-900";

  return (
    <div
      className={`relative rounded-xl border-2 border-slate-900 bg-linear-to-br ${cardAccent} shadow-[4px_4px_0px_0px_#0f172a] transition ${
        isOpening ? "opacity-70" : `${cardAccentHover} hover:-translate-y-0.5`
      }`}
    >
      {/* Top accent bar */}
      <div className={`rounded-t-[10px] px-4 py-2 flex items-center justify-between border-b-2 border-slate-900 ${isCashAdvance ? "bg-amber-100" : "bg-violet-100"}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold border border-slate-400 rounded-full px-2 py-0.5 text-slate-600 bg-white/70">
            {isManual ? "manual" : `${account.payment_frequency} · ${account.term_months}mo`}
          </span>
        </div>
        <span className={`text-[10px] mr-2 font-black uppercase px-2 py-0.5 rounded-full border border-slate-900 ${
          account.status === "active" ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-600"
        }`}>
          {account.status}
        </span>
      </div>

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
        className="min-w-0 w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 p-4"
        aria-label={`Open account`}
        aria-busy={isOpening}
      >
        {/* Hero: principal + interest + release date */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Principal</p>
            <p className="text-3xl font-black tabular-nums text-slate-900 leading-none">
              ₱{Number(account.principal_amount ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Interest</p>
              <p className="text-xl font-black text-slate-900">{account.interest_rate}%</p>
            </div>
            {account.release_date && (
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Released</p>
                <p className="text-sm font-black text-slate-900">
                  {new Date(account.release_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2 grid-cols-2">
          {/* bayranan */}
          <div className="rounded-lg border-2 border-slate-900 bg-purple-100/90 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">bayranan</p>
            <p className="text-lg font-black text-slate-900">₱{amountLeftToPay.toLocaleString()}</p>
          </div>

          {/* manual: nabayran | auto: ginansya */}
          {isManual ? (
            <div className="rounded-lg border-2 border-slate-900 bg-emerald-100/70 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">nabayran</p>
              <p className="text-lg font-black text-slate-900">₱{totalPaid.toLocaleString()}</p>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-slate-900 bg-amber-100/70 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ginansya / per payroll</p>
              <p className="text-lg font-black text-slate-900">
                ₱{Math.round(profitToMake).toLocaleString()} <span className="text-sm text-slate-500 font-bold">| ₱{Math.round(profitToMake / perPayrollDivisor).toLocaleString()}</span>
              </p>
            </div>
          )}

          {/* next collection */}
          {!isManual && (
            <div className="rounded-lg border-2 border-slate-900 bg-sky-100/70 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">next collection</p>
              <p className="text-lg font-black text-slate-900">
                {nextCollectionDate
                  ? new Date(nextCollectionDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "—"}
              </p>
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1 flex-wrap">
                ₱{nextCollectionAmount.toLocaleString()}
                {nextCollectionStatus === "partial" && nextCollectionAmountDue > nextCollectionAmount && (
                  <span className="text-slate-400 font-normal">of ₱{nextCollectionAmountDue.toLocaleString()}</span>
                )}
                {nextCollectionStatus && (
                  <span className={`text-[8px] font-black text-black px-1 shadow-[1px_1px_0px_0px_#333] rounded-xs border border-slate-900 uppercase ${
                    nextCollectionStatus === "overdue" ? "bg-red-500/70"
                      : nextCollectionStatus === "paid" ? "bg-green-500/70"
                      : nextCollectionStatus === "pending" ? "bg-yellow-500/70"
                      : nextCollectionStatus === "partial" ? "bg-purple-500/70"
                      : "bg-blue-500/70"
                  }`}>{nextCollectionStatus}</span>
                )}
              </p>
            </div>
          )}

          {/* overdue */}
          {overdueCount > 0 && (
            <div className="col-span-2 rounded-lg border-2 border-red-700 bg-red-100/70 p-2">
              <button
                type="button"
                data-prevent-account-open
                onClick={() => setOverdueExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">overdue · {overdueCount} schedule{overdueCount === 1 ? "" : "s"}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-red-800">₱{overdueTotal.toLocaleString()}</p>
                  <span className="text-[10px] text-red-600">{overdueExpanded ? "▲" : "▼"}</span>
                </div>
              </button>
              {overdueExpanded && (
                <div className="space-y-1 mt-1.5">
                  {(metrics?.overdueSchedules ?? []).map((os, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-slate-700">
                        {new Date(os.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="text-[10px] font-black text-red-700">₱{os.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

       
        </div>
          {/* progress */}
           {!isManual && totalDue > 0 && (
            <div className="sm:col-span-2 mt-2">
              <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-wide text-slate-500">
                <span>Progress</span>
                <span className="tabular-nums text-slate-700">{progressPct}%</span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
      </div>

      <div className="absolute right-3 top-2" data-prevent-account-open>
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="rounded-lg  ">
      <div className="mb-6 flex items-center justify-between">
     <div className=""></div>
        <NeobrutButton
          onClick={() => {
            setEditingAccount(null);
            setIsAccountDialogOpen(true);
          }}
          aria-label="Add loan"
          variant="green"
        >
          add loan
        </NeobrutButton>
      </div>

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
              <div className="mb-3 flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] ${accent}`}>
                  {label}
                </span>
                <span className="text-xs font-semibold text-slate-400">{group.length} account{group.length === 1 ? "" : "s"}</span>
              </div>
              <div className="space-y-4">
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black uppercase">
            Notes
          </h2>

          <NeobrutButton
            onClick={() => {
              setSelectedNote(null);
              setIsNotesOpen(true);
            }}
            variant="yellow"
          >
            New note
          </NeobrutButton>
        </div>

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
