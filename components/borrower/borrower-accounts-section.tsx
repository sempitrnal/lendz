"use client";

import { FaPlus } from "react-icons/fa6";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Modal from "@/components/modal";
import AccountForm from "@/components/forms/account-form";
import AccountCardMenu from "@/components/borrower/account-card-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { BorrowerSummary } from "./borrower-detail-view";
import { supabase } from "@/lib/supabase/client";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import NotesCanvas from "./notes-canvas";
import NeobrutButton from "../neobrut-button";
export type AccountRow = {
  id: string;
  type: string;
  status: string;
  principal_amount: number | string | null;
  interest_rate: number | string | null;
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
  nextUnpaidScheduleId: string | null;
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
  metrics,
  isMarkingNextPaid,
  onMarkNextPaid,
}: {
  account: AccountRow;
  isOpening: boolean;
  onOpen: (id: string) => void;
  metrics?: AccountComputedMetrics;
  isMarkingNextPaid: boolean;
  onMarkNextPaid: (accountId: string, scheduleId: string) => void;
}) {
  const amountLeftToPay = metrics?.amountLeftToPay ?? 0;
  const profitToMake = metrics?.profitToMake ?? 0;
  const nextCollectionDate = metrics?.nextCollectionDate;
  const nextCollectionAmount = metrics?.nextCollectionAmount ?? 0;
  const nextUnpaidScheduleId = metrics?.nextUnpaidScheduleId ?? null;

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
              ginansya
            </p>
            <p className="text-sm font-black text-slate-900">
              ₱{profitToMake.toLocaleString()}
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
                </p>
              </div>
              {nextUnpaidScheduleId ? (
                <button
                  type="button"
                  data-prevent-account-open
                  disabled={isMarkingNextPaid || isOpening}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkNextPaid(account.id, nextUnpaidScheduleId);
                  }}
                  className="shrink-0 rounded-md border-2 border-slate-900 bg-emerald-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
                >
                  {isMarkingNextPaid ? "..." : "Mark next paid"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <AccountCardMenu accountId={account.id} />
    </div>
  );
}
export default function BorrowerAccountsSection({
  borrowerId,
  accounts,
  borrower
}: BorrowerAccountsSectionProps) {
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
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

  const markNextSchedulePaid = async (
    _accountId: string,
    scheduleId: string
  ) => {
    setMarkingNextPaidScheduleId(scheduleId);
    const { data: row, error: fetchError } = await supabase
      .from("payment_schedules")
      .select("amount_due")
      .eq("id", scheduleId)
      .single();
    if (fetchError || !row) {
      setMarkingNextPaidScheduleId(null);
      toast.error(fetchError?.message ?? "Could not load schedule.");
      return;
    }
    const due = Number(row.amount_due ?? 0);
    const { error } = await supabase
      .from("payment_schedules")
      .update({
        status: "paid",
        amount_paid: due,
        remaining_amount: 0,
      })
      .eq("id", scheduleId);
    setMarkingNextPaidScheduleId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked next schedule as paid.");
    await fetchAccountMetrics();
    router.refresh();
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
      const nextUnpaid = rows.find((row) => !isInstallmentFullyPaid(row));

      computed[account.id] = {
        amountLeftToPay,
        profitToMake,
        nextCollectionDate: nextUnpaid?.due_date ?? null,
        nextCollectionAmount: nextUnpaid
          ? remainingOnInstallment(nextUnpaid)
          : 0,
        nextUnpaidScheduleId: nextUnpaid?.id ?? null,
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
          onClick={() => setIsAddAccountOpen(true)}
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
              metrics={accountMetricsById[account.id]}
              isMarkingNextPaid={
                markingNextPaidScheduleId ===
                accountMetricsById[account.id]?.nextUnpaidScheduleId
              }
              onMarkNextPaid={markNextSchedulePaid}
            />
          ))}
        </div>
      )}

      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>add account</DialogTitle>
          </DialogHeader>

          <AccountForm
            borrowerId={borrowerId}
            onSuccess={() => setIsAddAccountOpen(false)}
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
              {note.preview_image ? (
                <img
                  src={note.preview_image}
                  className="pointer-events-none rounded w-full"
                />
              ) : (
                <div className="h-20 " />
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
