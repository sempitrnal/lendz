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

type AccountComputedMetrics = {
  amountLeftToPay: number;
  profitToMake: number;
  nextCollectionDate: string | null;
  nextCollectionAmount: number;
  nextCollectionStatus: string | null;
  nextUnpaidScheduleId: string | null;
  overdueCount: number;
  overdueTotal: number;
  term_months?: string| number| null;
};

type BorrowerAccountsSectionProps = {
  borrowerId: string;
  accounts: AccountRow[] | null;
  borrower?: BorrowerSummary
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
  const nextCollectionDate = metrics?.nextCollectionDate;
  const nextCollectionAmount = metrics?.nextCollectionAmount ?? 0;
  const nextCollectionStatus = metrics?.nextCollectionStatus ?? null;
  const overdueCount = metrics?.overdueCount ?? 0;
  const overdueTotal = metrics?.overdueTotal ?? 0;

  function tryOpenAccount(e: SyntheticEvent) {
    if (isOpening) return;
    if (
      (e.target as HTMLElement).closest("[data-prevent-account-open]")
    ) {
      return;
    }
    onOpen(account.id);
  }

  return (
    <div
      className={`flex relative gap-2 rounded-xl border-2 border-slate-900 bg-linear-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-[4px_4px_0px_0px_#0f172a] transition ${isOpening ? "opacity-70" : "hover:-translate-y-0.5 hover:from-violet-100 hover:to-fuchsia-100"
        }`}
    >
      <div
        role="button"
        tabIndex={isOpening ? -1 : 0}
        onClick={tryOpenAccount}
        onKeyDown={(e) => {
          if (isOpening) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          if (
            (e.target as HTMLElement).closest("[data-prevent-account-open]")
          ) {
            return;
          }
          e.preventDefault();
          onOpen(account.id);
        }}
        aria-disabled={isOpening}
        className="min-w-0 flex-1 pr-2 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        aria-label={`Open account for ${account.type.replace("_", " ")}`}
        aria-busy={isOpening}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-black uppercase text-slate-900">
              {account.type.replace("_", " ")}
            </p>

            <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
              Status: {account.status}
            </p>
          </div>

          <div className="text-right">
            <p className="font-black text-slate-900">
              ₱{Number(account.principal_amount ?? 0).toLocaleString()}
            </p>

            <p className="text-xs font-semibold text-slate-500">
              {account.interest_rate}% interest
            </p>
            {isOpening ? (
              <p className="mt-1 text-xs font-medium text-slate-600">
                Opening account...
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
       <div className="flex w-full gap-2">
       <div className="rounded-lg w-full border-2 border-slate-900 bg-emerald-100/70 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              bayranan
            </p>
            <p className="text-sm font-black text-slate-900">
              ₱{amountLeftToPay.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg w-full border-2 border-slate-900 bg-amber-100/70 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              ginansya /  per payroll
            </p>
            <p className="text-sm font-black text-slate-900">
   ₱{profitToMake.toLocaleString()} | ₱{(profitToMake / (Number(metrics?.term_months) || 1)).toLocaleString()}
            </p>
          </div>

       </div>
          <div className="rounded-lg border-2 border-slate-900 bg-sky-100/70 p-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  next collection
                </p>
                <p className="text-sm font-black text-slate-900">
                  {nextCollectionDate
                    ? new Date(nextCollectionDate).toLocaleDateString()
                    : "none"}
                </p>
                <p className="text-[11px] font-semibold text-slate-600">
                  ₱{nextCollectionAmount.toLocaleString()}
                  {nextCollectionStatus ? (
                      <span className={`ml-1 text-[8px]  font-black text-black px-1 shadow-[2px_2px_0px_0px_#333] rounded-xs border border-slate-900   uppercase ${nextCollectionStatus === "overdue" ? "bg-red-500/70" : nextCollectionStatus === "paid" ? "bg-green-500/70" : nextCollectionStatus === "pending" ? "bg-yellow-500/70" : nextCollectionStatus === "partial" ? "bg-purple-500/70" : "bg-blue-500/70"}`}>
                           {nextCollectionStatus}
                         </span>
                  ) : null}
                </p>
              </div>

            </div>
          </div>
          {overdueCount > 0 ? (
            <div className="rounded-lg border-2 border-slate-900 bg-red-100/70 p-2 sm:col-span-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                overdue
              </p>
              <p className="text-sm font-black text-red-700">
                {overdueCount} schedule{overdueCount === 1 ? "" : "s"} • ₱{overdueTotal.toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <AccountCardMenu
        accountId={account.id}
        onEdit={() => onEdit(account)}
      />
    </div>
  );
}
export default function BorrowerAccountsSection({
  borrowerId,
  accounts,
  borrower
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
  >({});
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
      const rows = byAccount.get(account.id) ?? [];
      const totalPayment = rows.reduce(
        (sum, row) => sum + Number(row.amount_due ?? 0),
        0
      );
      const amountPaid = rows.reduce(
        (sum, row) => sum + amountPaidOnInstallment(row),
        0
      );
      const amountLeftToPay = rows.reduce(
        (sum, row) => sum + remainingOnInstallment(row),
        0
      );
      const principal = Number(account.principal_amount ?? 0);
      const profitToMake = Math.max(0, totalPayment - principal);
      const nextUnpaid = nextDueScheduleForCollection(rows);
      const overdueRows = rows.filter(
        (row) => row.status === "overdue" && !isInstallmentFullyPaid(row)
      );
      
      computed[account.id] = {
        amountLeftToPay,
        profitToMake,
        nextCollectionDate: nextUnpaid?.due_date ?? null,
        nextCollectionAmount: nextUnpaid
          ? remainingOnInstallment(nextUnpaid)
          : 0,
        nextCollectionStatus: nextUnpaid?.status ?? null,
        nextUnpaidScheduleId: nextUnpaid?.id ?? null,
        overdueCount: overdueRows.length,
        term_months: account.term_months,

        overdueTotal: overdueRows.reduce(
          (sum, row) => sum + remainingOnInstallment(row),
          0
        ),
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
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
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
        <DialogContent className="max-w-5xl">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
