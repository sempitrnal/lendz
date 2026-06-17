"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import {
  revalidateBorrowersPage,
  revalidateDeletedPage,
} from "@/lib/actions/borrowers";
import { Borrower } from "@/components/borrower/borrower-list";
import { AccountRow } from "@/components/borrower/borrower-accounts-section";
import NeobrutButton from "@/components/neobrut-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeletedBorrower = Borrower & {
  deleted_at?: string | null;
};

type DeletedAccount = AccountRow & {
  deleted_at?: string | null;
  created_at?: string | null;
  borrower: { id: string; first_name: string; last_name: string } | null;
};

type DeletedPageClientProps = {
  initialBorrowers: DeletedBorrower[];
  initialAccounts: DeletedAccount[];
};

export default function DeletedPageClient({
  initialBorrowers,
  initialAccounts,
}: DeletedPageClientProps) {
  const router = useRouter();
  const [borrowers, setBorrowers] = useState(initialBorrowers);
  const [accounts, setAccounts] = useState(initialAccounts);

  const [selectedBorrowerIds, setSelectedBorrowerIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    setBorrowers(initialBorrowers);
    setAccounts(initialAccounts);
    setSelectedBorrowerIds(new Set());
    setSelectedAccountIds(new Set());
  }, [initialBorrowers, initialAccounts]);

  const [isRestoring, setIsRestoring] = useState(false);
  const [isPermaDeleting, setIsPermaDeleting] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState<
    "borrowers" | "accounts" | null
  >(null);

  const selectedCount = selectedBorrowerIds.size + selectedAccountIds.size;

  const toggleBorrower = (id: string) => {
    setSelectedBorrowerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllBorrowers = () => {
    setSelectedBorrowerIds(new Set(borrowers.map((b) => b.id)));
  };

  const selectAllAccounts = () => {
    setSelectedAccountIds(new Set(accounts.map((a) => a.id)));
  };

  const clearSelection = () => {
    setSelectedBorrowerIds(new Set());
    setSelectedAccountIds(new Set());
  };

  const handleBulkRestore = async () => {
    if (selectedCount === 0) return;
    setIsRestoring(true);
    try {
      const borrowerIds = Array.from(selectedBorrowerIds);
      const accountIds = Array.from(selectedAccountIds);

      if (borrowerIds.length > 0) {
        const { error } = await supabase
          .from("borrowers")
          .update({ deleted_at: null })
          .in("id", borrowerIds);
        if (error) {
          toast.error(error.message);
          return;
        }
      }

      if (accountIds.length > 0) {
        const { error } = await supabase
          .from("accounts")
          .update({ deleted_at: null })
          .in("id", accountIds);
        if (error) {
          toast.error(error.message);
          return;
        }
      }

      toast.success(
        `Restored ${selectedCount} item${selectedCount === 1 ? "" : "s"}`,
      );
      clearSelection();
      await revalidateBorrowersPage();
      await revalidateDeletedPage();
      router.refresh();
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBulkPermaDelete = async () => {
    if (selectedCount === 0) return;
    setIsPermaDeleting(true);
    try {
      const borrowerIds = Array.from(selectedBorrowerIds);
      const accountIds = Array.from(selectedAccountIds);

      if (borrowerIds.length > 0) {
        const { error } = await supabase
          .from("borrowers")
          .delete()
          .in("id", borrowerIds);
        if (error) {
          toast.error(error.message);
          return;
        }
      }

      if (accountIds.length > 0) {
        const { error } = await supabase
          .from("accounts")
          .delete()
          .in("id", accountIds);
        if (error) {
          toast.error(error.message);
          return;
        }
      }

      toast.success(
        `Permanently deleted ${selectedCount} item${selectedCount === 1 ? "" : "s"}`,
      );
      clearSelection();
      await revalidateBorrowersPage();
      await revalidateDeletedPage();
      router.refresh();
    } finally {
      setIsPermaDeleting(false);
    }
  };

  const handleClearAll = async (type: "borrowers" | "accounts") => {
    setIsPermaDeleting(true);
    try {
      if (type === "borrowers") {
        const ids = borrowers.map((b) => b.id);
        if (ids.length > 0) {
          const { error } = await supabase
            .from("borrowers")
            .delete()
            .in("id", ids);
          if (error) {
            toast.error(error.message);
            return;
          }
        }
        toast.success(
          `Cleared all ${ids.length} deleted borrower${ids.length === 1 ? "" : "s"}`,
        );
        setBorrowers([]);
      } else {
        const ids = accounts.map((a) => a.id);
        if (ids.length > 0) {
          const { error } = await supabase
            .from("accounts")
            .delete()
            .in("id", ids);
          if (error) {
            toast.error(error.message);
            return;
          }
        }
        toast.success(
          `Cleared all ${ids.length} deleted account${ids.length === 1 ? "" : "s"}`,
        );
        setAccounts([]);
      }
      clearSelection();
      await revalidateBorrowersPage();
      await revalidateDeletedPage();
      router.refresh();
    } finally {
      setIsPermaDeleting(false);
      setConfirmClearAll(null);
    }
  };

  const formatCurrency = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">recently deleted</h1>
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="dark:border-border dark:bg-card dark:text-foreground
                rounded-lg border-2 border-slate-900 bg-white px-2.5 py-1
                text-xs font-bold shadow-[1px_1px_0px_0px_#0f172a] transition
                hover:-translate-y-0.5 active:translate-y-px active:shadow-none"
            >
              clear
            </button>
            <button
              type="button"
              disabled={isRestoring}
              onClick={handleBulkRestore}
              className="rounded-lg border-2 border-slate-900 bg-lime-300 px-2.5
                py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#0f172a]
                transition hover:-translate-y-0.5 active:translate-y-px
                active:shadow-none disabled:opacity-50 dark:border-lime-600
                dark:bg-lime-400/80"
            >
              {isRestoring ? "restoring..." : "restore"}
            </button>
            <button
              type="button"
              disabled={isPermaDeleting}
              onClick={handleBulkPermaDelete}
              className="rounded-lg border-2 border-slate-900 bg-red-400 px-2.5
                py-1 text-xs font-bold text-white
                shadow-[1px_1px_0px_0px_#0f172a] transition
                hover:-translate-y-0.5 active:translate-y-px active:shadow-none
                disabled:opacity-50 dark:border-red-500/50 dark:bg-red-500/80"
            >
              {isPermaDeleting ? "deleting..." : "perma delete"}
            </button>
          </div>
        )}
      </div>

      {/* Borrowers Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full border-2 border-slate-900 bg-indigo-200
                px-2.5 py-1 text-[10px] font-black tracking-widest
                text-indigo-900 uppercase shadow-[1px_1px_0px_0px_#0f172a]"
            >
              borrowers
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {borrowers.length} deleted
            </span>
          </div>
          {borrowers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAllBorrowers}
                className="text-xs font-bold text-slate-500 underline
                  decoration-2 underline-offset-2 hover:text-slate-700"
              >
                select all
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setConfirmClearAll("borrowers")}
                className="text-xs font-bold text-red-400 underline decoration-2
                  underline-offset-2 hover:text-red-600"
              >
                clear all
              </button>
            </div>
          )}
        </div>

        {borrowers.length === 0 ? (
          <p
            className="rounded-xl border border-dashed p-6 text-center text-sm
              text-slate-400"
          >
            No deleted borrowers
          </p>
        ) : (
          <div className="space-y-2">
            {borrowers.map((b) => {
              const selected = selectedBorrowerIds.has(b.id);
              return (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4
                    py-3 transition-all ${
                      selected
                        ? `border-indigo-500 bg-indigo-50
                          shadow-[2px_2px_0px_0px_#6366f1]
                          dark:border-indigo-400 dark:bg-indigo-900/20`
                        : `dark:border-border dark:bg-card border-slate-900
                          bg-white shadow-[2px_2px_0px_0px_#0f172a]`
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleBorrower(b.id)}
                    className={`flex size-5 shrink-0 items-center justify-center
                      rounded border-2 transition-colors ${
                        selected
                          ? `border-slate-900 bg-slate-900 dark:border-amber-400
                            dark:bg-amber-400`
                          : `dark:bg-card border-slate-300 bg-white
                            dark:border-slate-600`
                      }`}
                    aria-label={
                      selected ? "Deselect borrower" : "Select borrower"
                    }
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">
                      {b.first_name} {b.last_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      deleted{" "}
                      {new Date(
                        b.deleted_at ?? b.created_at,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  {b.contact && (
                    <span
                      className="hidden shrink-0 text-xs text-slate-500
                        sm:inline"
                    >
                      {b.contact}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Accounts Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full border-2 border-slate-900 bg-violet-200
                px-2.5 py-1 text-[10px] font-black tracking-widest
                text-violet-900 uppercase shadow-[1px_1px_0px_0px_#0f172a]"
            >
              accounts
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {accounts.length} deleted
            </span>
          </div>
          {accounts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAllAccounts}
                className="text-xs font-bold text-slate-500 underline
                  decoration-2 underline-offset-2 hover:text-slate-700"
              >
                select all
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setConfirmClearAll("accounts")}
                className="text-xs font-bold text-red-400 underline decoration-2
                  underline-offset-2 hover:text-red-600"
              >
                clear all
              </button>
            </div>
          )}
        </div>

        {accounts.length === 0 ? (
          <p
            className="rounded-xl border border-dashed p-6 text-center text-sm
              text-slate-400"
          >
            No deleted accounts
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => {
              const selected = selectedAccountIds.has(a.id);
              const principal = Number(a.principal_amount ?? 0);
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4
                    py-3 transition-all ${
                      selected
                        ? `border-violet-500 bg-violet-50
                          shadow-[2px_2px_0px_0px_#8b5cf6]
                          dark:border-violet-400 dark:bg-violet-900/20`
                        : `dark:border-border dark:bg-card border-slate-900
                          bg-white shadow-[2px_2px_0px_0px_#0f172a]`
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccount(a.id)}
                    className={`flex size-5 shrink-0 items-center justify-center
                      rounded border-2 transition-colors ${
                        selected
                          ? `border-slate-900 bg-slate-900 dark:border-amber-400
                            dark:bg-amber-400`
                          : `dark:bg-card border-slate-300 bg-white
                            dark:border-slate-600`
                      }`}
                    aria-label={
                      selected ? "Deselect account" : "Select account"
                    }
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">
                      {a.borrower
                        ? `${a.borrower.first_name} ${a.borrower.last_name}`
                        : "Unknown borrower"}{" "}
                      <span className="font-normal text-slate-400">
                        &middot; {formatCurrency(principal)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      deleted{" "}
                      {new Date(
                        a.deleted_at ?? a.created_at ?? "",
                      ).toLocaleDateString()}{" "}
                      <span
                        className={`rounded px-1 py-px text-[10px] font-bold
                          uppercase ${
                            a.type === "cash_advance"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-violet-100 text-violet-800"
                          }`}
                      >
                        {a.type?.replace("_", " ")}
                      </span>
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Confirm Clear All Dialog */}
      <Dialog
        open={confirmClearAll !== null}
        onOpenChange={() => setConfirmClearAll(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all deleted {confirmClearAll}</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            This will permanently delete all {confirmClearAll} in the trash.
            This action cannot be undone.
          </DialogDescription>
          <DialogFooter>
            <div className="flex justify-end gap-3">
              <NeobrutButton
                variant="white"
                disabled={isPermaDeleting}
                onClick={() => setConfirmClearAll(null)}
              >
                cancel
              </NeobrutButton>
              <NeobrutButton
                variant="red"
                disabled={isPermaDeleting}
                onClick={() =>
                  confirmClearAll && handleClearAll(confirmClearAll)
                }
              >
                {isPermaDeleting ? "deleting..." : "permanently delete all"}
              </NeobrutButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
