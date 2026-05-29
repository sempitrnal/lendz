"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NeobrutButton from "@/components/neobrut-button";

export type CalendarEventFormData = {
  borrower_id: string;
  account_id: string;
  event_date: string;
  title: string;
  note: string;
  amount: number;
};

type BorrowerOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type AccountOption = {
  id: string;
  principal_amount: number | null;
  status: string;
};

type AddEventModalProps = {
  open: boolean;
  onClose: () => void;
  borrowers: BorrowerOption[];
  accountsByBorrower: Record<string, AccountOption[]>;
  onSubmit: (data: CalendarEventFormData) => Promise<{ error?: string }>;
};

export default function AddEventModal({
  open,
  onClose,
  borrowers,
  accountsByBorrower,
  onSubmit,
}: AddEventModalProps) {
  const [borrowerId, setBorrowerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [borrowerSearch, setBorrowerSearch] = useState("");

  const availableAccounts = accountsByBorrower[borrowerId] ?? [];

  const filteredBorrowers = borrowers.filter((b) => {
    const q = borrowerSearch.trim().toLowerCase();
    if (!q) return true;
    const full = `${b.first_name} ${b.last_name}`.toLowerCase();
    return full.includes(q);
  });

  function reset() {
    setBorrowerId("");
    setAccountId("");
    setEventDate("");
    setTitle("");
    setNote("");
    setAmount("");
    setBorrowerSearch("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!borrowerId || !eventDate) {
      setError("Borrower and date are required");
      return;
    }
    startTransition(async () => {
      const res = await onSubmit({
        borrower_id: borrowerId,
        account_id: accountId,
        event_date: eventDate,
        title: title.trim(),
        note: note.trim(),
        amount: Number(amount) || 0,
      });
      if (res?.error) {
        setError(res.error);
      } else {
        reset();
        onClose();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-black uppercase tracking-wide text-slate-900">
            schedule borrower
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <p className="rounded bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              borrower
            </label>
            <div className="relative">
              <input
                type="text"
                value={borrowerSearch}
                onChange={(e) => {
                  setBorrowerSearch(e.target.value);
                  if (borrowerId) {
                    setBorrowerId("");
                    setAccountId("");
                  }
                }}
                placeholder="search borrowers..."
                className="w-full rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300"
              />
              {borrowerSearch.trim() && !borrowerId && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-40 flex-col gap-0.5 overflow-auto rounded-lg border-2 border-slate-900 bg-white p-1 shadow-[2px_2px_0px_0px_#0f172a]">
                  {filteredBorrowers.length === 0 ? (
                    <p className="px-3 py-2 text-xs font-bold text-slate-400">no matches</p>
                  ) : (
                    filteredBorrowers.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setBorrowerId(b.id);
                          setBorrowerSearch(`${b.first_name} ${b.last_name}`);
                          setAccountId("");
                        }}
                        className="rounded-md px-3 py-2 text-left text-sm font-bold text-slate-900 transition-colors hover:bg-green-100"
                      >
                        {b.first_name} {b.last_name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {borrowerId && (
              <p className="mt-1 text-xs font-bold text-emerald-700">
                selected: {borrowers.find((b) => b.id === borrowerId)?.first_name}{" "}
                {borrowers.find((b) => b.id === borrowerId)?.last_name}
              </p>
            )}
          </div>

          {borrowerId && availableAccounts.length > 0 ? (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                loan (optional)
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300"
              >
                <option value="">select loan</option>
                {availableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    ₱{Number(a.principal_amount ?? 0).toLocaleString()} — {a.status}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              date
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              amount
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. renewal, follow-up"
              className="rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" type="button" onClick={handleClose}>
              cancel
            </Button>
            <NeobrutButton variant="green" type="submit" disabled={isPending}>
              {isPending ? "saving..." : "save"}
            </NeobrutButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
