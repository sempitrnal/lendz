"use client";

import { ArrowLeft, Plus, Wallet, Pencil, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import AccountForm, {
  accountRowToFormInitial,
  type AccountEditableRow,
} from "@/components/forms/account-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { BorrowerSummary } from "./borrower-detail-view";
import { supabase } from "@/lib/supabase/client";
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import {
  useBorrowerDetails,
  useInvalidateBorrowerDetails,
} from "@/lib/hooks/use-borrower-details";
import dynamic from "next/dynamic";

const NotesCanvas = dynamic(() => import("./notes-canvas"), { ssr: false });
import ActivateAccountDialog from "./activate-account-dialog";
import { AccountCard } from "./account-card";
import { motion } from "framer-motion";
import { StickyBorrowerStrip } from "./sticky-borrower-strip";

const groupVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const cardContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
};

const notesVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
      delay: 0.2,
    },
  },
};

export type AccountRow = AccountEditableRow & {
  id: string;
  borrower_id: string;
  status: string;
  first_payment_date: string | null;
};
export type AccountComputedMetrics = {
  amountLeftToPay: number;
  profitToMake: number;
  daysSinceRelease: number;
  profitPerSchedule: number;
  nextCollectionDate: string | null;
  nextCollectionAmount: number;
  nextCollectionAmountDue: number;
  nextCollectionStatus: string | null;
  nextUnpaidScheduleId: string | null;
  nextCollections: {
    due_date: string;
    amount: number;
    amount_due: number;
    status: string;
  }[];
  overdueCount: number;
  overdueTotal: number;
  overdueSchedules: { due_date: string; amount: number }[];
  totalDue: number;
  totalPaid: number;
  term_months?: string | number | null;
  term_installments?: string | number | null;
  schedule_mode?: string | null;
};

type BorrowerAccountsSectionProps = {
  borrowerId: string;
  accounts: AccountRow[] | null;
  borrower?: BorrowerSummary;
  initialMetrics?: Record<string, AccountComputedMetrics>;
  deletedAccounts?: AccountRow[];
};

export default function BorrowerAccountsSection({
  borrowerId,
  accounts,
  borrower,
  initialMetrics,
  deletedAccounts = [],
}: BorrowerAccountsSectionProps) {
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [openingAccountId, setOpeningAccountId] = useState<string | null>(null);
  const [activatingAccount, setActivatingAccount] = useState<AccountRow | null>(
    null,
  );
  const [fabOpen, setFabOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const router = useRouter();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const {
    data: queryData,
    isLoading: isQueryLoading,
    isError: isQueryError,
    error: queryError,
    isFetching,
  } = useBorrowerDetails(
    borrowerId,
    borrower
      ? {
          borrower: {
            id: borrower.id,
            first_name: borrower.first_name,
            last_name: borrower.last_name,
            contact: borrower.contact,
            created_at: (borrower as any).created_at ?? "",
          },
          accounts: (accounts as any[]) ?? [],
          metrics: (initialMetrics as any) ?? {},
        }
      : undefined,
  );
  const { resolvedTheme } = useTheme();
  const notes = (queryData?.notes ?? []) as any[];
  const accountMetricsById = (queryData?.metrics ??
    initialMetrics ??
    {}) as Record<string, AccountComputedMetrics>;
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const deleteNote = async (id: string) => {
    const confirmed = window.confirm("Delete this note?");

    if (!confirmed) return;

    const { error } = await supabase
      .from("borrower_notes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    invalidateBorrowerDetails(borrowerId);
    setIsNotesOpen(false);
    setSelectedNote(null);
  };
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const noteDraftsRef = useRef<Record<string, Record<string, unknown>>>({});

  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const handleOpenAccount = (id: string) => {
    setOpeningAccountId(id);
    router.push(`/accounts/${id}`);
  };

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
        if (next.size === 0) {
          setSelectionMode(false);
        }
      } else {
        next.add(accountId);
        if (!selectionMode) {
          setSelectionMode(true);
        }
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedAccountIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    if (selectedAccountIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedAccountIds);
      const { error } = await supabase
        .from("accounts")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        `Deleted ${ids.length} account${ids.length === 1 ? "" : "s"}`,
      );
      clearSelection();
      await revalidateBorrowerDetailPage(borrowerId);
      router.refresh();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleRestoreAccount = async (accountId: string) => {
    setRestoringIds((prev) => new Set(prev).add(accountId));
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ deleted_at: null })
        .eq("id", accountId);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Account restored");
      await revalidateBorrowerDetailPage(borrowerId);
      router.refresh();
    } finally {
      setRestoringIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };
  const handlePrefetchAccount = (id: string) => {
    router.prefetch(`/accounts/${id}`);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const summaryStats = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    const totalLoaned = accounts.reduce(
      (s, a) => s + Number(a.principal_amount ?? 0),
      0,
    );
    const metricsArr = Object.values(accountMetricsById);
    const totalExpected = metricsArr.reduce((s, m) => s + m.profitToMake, 0);
    const totalAmountCollected = metricsArr.reduce(
      (s, m) => s + m.totalPaid,
      0,
    );
    const totalRemaining = metricsArr.reduce(
      (s, m) => s + m.amountLeftToPay,
      0,
    );
    const totalCollected = metricsArr.reduce(
      (s, m) =>
        s + (m.totalDue > 0 ? m.profitToMake * (m.totalPaid / m.totalDue) : 0),
      0,
    );
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
    const collectedPct =
      totalExpected > 0
        ? Math.min(100, Math.round((totalCollected / totalExpected) * 100))
        : 0;
    return {
      totalLoaned,
      totalExpected,
      totalCollected,
      totalAmountCollected,
      totalRemaining,
      profitPerSchedule,
      collectedPct,
    };
  }, [accounts, accountMetricsById]);

  const nextAmountsText = useMemo(() => {
    if (!accounts) return "";
    const lines = accounts
      .map((a) => accountMetricsById[a.id]?.nextCollectionAmount)
      .filter((amount): amount is number => Boolean(amount) && amount > 0)
      .map((amount) => `₱${amount.toLocaleString()}`);
    return lines.join("\n");
  }, [accounts, accountMetricsById]);

  const handleCopyNextCollections = async () => {
    if (!nextAmountsText) {
      toast.info("No next collection amounts to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(nextAmountsText);
      toast.success("Copied next collection amounts");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = nextAmountsText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Copied next collection amounts");
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <>
      {borrower && (
        <StickyBorrowerStrip
          borrower={borrower}
          totalLoaned={summaryStats?.totalLoaned ?? 0}
          totalExpected={summaryStats?.totalExpected ?? 0}
          totalCollected={summaryStats?.totalCollected ?? 0}
          totalAmountCollected={summaryStats?.totalAmountCollected ?? 0}
          totalRemaining={summaryStats?.totalRemaining ?? 0}
          profitPerSchedule={summaryStats?.profitPerSchedule ?? 0}
          collectedPct={summaryStats?.collectedPct ?? 0}
        />
      )}

      <div className="mx-auto max-w-7xl md:max-w-full px-4 pb-16 md:px-6">
        {isQueryLoading && !queryData && (
          <div className="flex flex-col items-center gap-2 py-8">
            <div
              className="size-6 animate-spin rounded-full border-2
                border-slate-900 border-t-transparent"
            />
            <p className="text-xs font-bold text-slate-500">
              Loading borrower details…
            </p>
          </div>
        )}

        {isQueryError && (
          <div
            className="rounded-lg border-2 border-red-500 bg-red-50 p-4 text-sm
              font-bold text-red-700"
          >
            {queryError instanceof Error
              ? queryError.message
              : "Failed to load borrower details."}
          </div>
        )}

        {isFetching && queryData && (
          <div className="flex items-center justify-end gap-1.5 px-1 py-1">
            <span
              className="inline-block size-2 animate-pulse rounded-full
                bg-emerald-500"
            />
            <span className="text-[10px] font-bold text-slate-400">
              Refreshing data…
            </span>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              router.push("/borrowers", { scroll: false });
              router.refresh();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold
              text-slate-600 transition hover:text-slate-600 dark:text-slate-400
              dark:hover:text-slate-200"
          >
            <ArrowLeft className="size-3.5" />
            back to borrowers
          </button>
          <button
            type="button"
            onClick={handleCopyNextCollections}
            disabled={!nextAmountsText}
            className="inline-flex items-center gap-1.5 rounded-lg border
              border-slate-300 bg-white px-3 py-1.5 text-xs font-bold
              text-slate-600 shadow-sm transition hover:bg-slate-50
              active:translate-y-px active:shadow-none disabled:opacity-50
              dark:border-slate-700 dark:bg-card dark:text-slate-300
              dark:hover:bg-slate-800/50"
          >
            <Copy className="size-3.5" />
            copy amounts
          </button>
        </div>

        {selectionMode && (
          <div
            className="dark:border-border dark:bg-card sticky top-[52px] z-40
              -mx-4 mb-4 border-y border-slate-300 bg-white px-4 py-2 shadow-sm
              md:top-[68px]"
          >
            <div className="flex items-center justify-between">
              <span
                className="dark:text-foreground text-sm font-black
                  text-slate-700"
              >
                {selectedAccountIds.size} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="dark:border-border dark:bg-card
                    dark:text-foreground rounded-lg border border-slate-300
                    bg-white px-3 py-1 text-xs font-bold transition
                    hover:-translate-y-0.5 active:translate-y-px
                    active:shadow-none"
                >
                  cancel
                </button>
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={handleBulkDelete}
                  className="rounded-lg border border-slate-300 bg-red-400 px-3
                    py-1 text-xs font-bold text-white transition
                    hover:-translate-y-0.5 active:translate-y-px
                    active:shadow-none disabled:opacity-50
                    dark:border-red-500/50 dark:bg-red-500/80"
                >
                  {isBulkDeleting
                    ? "deleting..."
                    : `delete ${selectedAccountIds.size}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {!accounts || accounts.length === 0 ? (
          <motion.div
            className="rounded-xl border border-dashed p-10 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <p className="text-gray-500">No accounts yet</p>
          </motion.div>
        ) : (
          (() => {
            const sortByNextDue = (group: typeof accounts) =>
              [...group].sort((a, b) => {
                const ma = accountMetricsById[a.id];
                const mb = accountMetricsById[b.id];
                const da = ma?.nextCollectionDate
                  ? new Date(ma.nextCollectionDate).getTime()
                  : Infinity;
                const db = mb?.nextCollectionDate
                  ? new Date(mb.nextCollectionDate).getTime()
                  : Infinity;
                return da - db;
              });
            const activeAutoLoans = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status !== "pending" &&
                  a.type !== "cash_advance" &&
                  a.schedule_mode !== "manual",
              ),
            );
            const activeManualFlatLoans = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status !== "pending" &&
                  a.type !== "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type !== "rolling",
              ),
            );
            const activeManualRollingLoans = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status !== "pending" &&
                  a.type !== "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type === "rolling",
              ),
            );
            const activeAutoCashAdvances = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status !== "pending" &&
                  a.type === "cash_advance" &&
                  a.schedule_mode !== "manual",
              ),
            );
            const activeManualFlatCashAdvances = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status !== "pending" &&
                  a.type === "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type !== "rolling",
              ),
            );
            const activeManualRollingCashAdvances = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status !== "pending" &&
                  a.type === "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type === "rolling",
              ),
            );
            const pendingAutoLoans = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status === "pending" &&
                  a.type !== "cash_advance" &&
                  a.schedule_mode !== "manual",
              ),
            );
            const pendingManualFlatLoans = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status === "pending" &&
                  a.type !== "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type !== "rolling",
              ),
            );
            const pendingManualRollingLoans = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status === "pending" &&
                  a.type !== "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type === "rolling",
              ),
            );
            const pendingAutoCashAdvances = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status === "pending" &&
                  a.type === "cash_advance" &&
                  a.schedule_mode !== "manual",
              ),
            );
            const pendingManualFlatCashAdvances = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status === "pending" &&
                  a.type === "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type !== "rolling",
              ),
            );
            const pendingManualRollingCashAdvances = sortByNextDue(
              accounts.filter(
                (a) =>
                  a.status === "pending" &&
                  a.type === "cash_advance" &&
                  a.schedule_mode === "manual" &&
                  (a as any).interest_type === "rolling",
              ),
            );
            const pendingAutoAll = [
              ...pendingAutoLoans,
              ...pendingAutoCashAdvances,
            ];
            const pendingManualFlatAll = [
              ...pendingManualFlatLoans,
              ...pendingManualFlatCashAdvances,
            ];
            const pendingManualRollingAll = [
              ...pendingManualRollingLoans,
              ...pendingManualRollingCashAdvances,
            ];

            const renderGroup = (
              group: typeof accounts,
              label: string,
              accent: string,
            ) =>
              group.length === 0 ? null : (
                <motion.div
                  variants={groupVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                >
                  <div className="mt-10 mb-3 flex items-center gap-2">
                    <span
                      className={`rounded-full border border-slate-300 font-black px-2.5 py-1 text-[10px]  ${accent}`}
                    >
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {group.length} account{group.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <motion.div
                    className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
                    variants={cardContainerVariants}
                  >
                    {group.map((account) => {
                      const m = accountMetricsById[account.id];
                      return (
                        <motion.div
                          key={account.id}
                          variants={cardVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <AccountCard
                            account={account}
                            isOpening={openingAccountId === account.id}
                            onOpen={handleOpenAccount}
                            onPrefetch={handlePrefetchAccount}
                            onEdit={(acc) => {
                              setEditingAccount(acc);
                              setIsAccountDialogOpen(true);
                            }}
                            onActivate={(acc) => setActivatingAccount(acc)}
                            metrics={m}
                            selectionMode={selectionMode}
                            selected={selectedAccountIds.has(account.id)}
                            onToggleSelect={toggleAccountSelection}
                          />
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              );

            return (
              <div className="space-y-10">
                {renderGroup(
                  activeAutoLoans,
                  "loans",
                  "bg-violet-200 text-violet-900",
                )}
                {renderGroup(
                  activeManualFlatLoans,
                  "manual flat loans",
                  "bg-lime-200 text-lime-900",
                )}
                {renderGroup(
                  activeManualRollingLoans,
                  "manual rolling loans",
                  "bg-cyan-200 text-cyan-900",
                )}
                {renderGroup(
                  activeAutoCashAdvances,
                  "cash advances",
                  "bg-amber-200 text-amber-900",
                )}
                {renderGroup(
                  activeManualFlatCashAdvances,
                  "manual flat cash advances",
                  "bg-yellow-200 text-yellow-900",
                )}
                {renderGroup(
                  activeManualRollingCashAdvances,
                  "manual rolling cash advances",
                  "bg-teal-200 text-teal-900",
                )}
                {renderGroup(
                  pendingAutoAll,
                  "pending",
                  "bg-amber-50 text-amber-800",
                )}
                {renderGroup(
                  pendingManualFlatAll,
                  "manual flat pending",
                  "bg-emerald-50 text-emerald-800",
                )}
                {renderGroup(
                  pendingManualRollingAll,
                  "manual rolling pending",
                  "bg-cyan-50 text-cyan-800",
                )}
              </div>
            );
          })()
        )}

        {deletedAccounts.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="rounded-full border-2 border-slate-900 bg-red-100
                  px-2.5 py-1 text-[10px] font-black tracking-widest
                  text-red-800 uppercase shadow-[2px_2px_0px_0px_#0f172a]
                  dark:border-red-400/40 dark:bg-red-400/[0.15]
                  dark:text-red-300"
              >
                recently deleted
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {deletedAccounts.length} account
                {deletedAccounts.length === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
            >
              {deletedAccounts.map((account) => {
                const isRestoring = restoringIds.has(account.id);
                const principal = Number(account.principal_amount ?? 0);
                return (
                  <div
                    key={account.id}
                    className="dark:border-border dark:bg-card flex items-center
                      justify-between rounded-xl border-2 border-slate-900/40
                      bg-slate-50 px-4 py-3 opacity-70
                      shadow-[1px_1px_0px_0px_rgb(15_23_42/0.2)]
                      dark:shadow-none"
                  >
                    <div>
                      <p
                        className="dark:text-foreground text-sm font-bold
                          text-slate-700"
                      >
                        {account.type.replace("_", " ")}
                      </p>
                      <p
                        className="dark:text-muted-foreground text-xs
                          text-slate-500"
                      >
                        ₱{principal.toLocaleString()} ·{" "}
                        {account.payment_frequency}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={() => handleRestoreAccount(account.id)}
                      className="dark:border-border dark:bg-card
                        dark:text-foreground rounded-lg border-2
                        border-slate-900 bg-white px-3 py-1.5 text-xs font-bold
                        transition hover:-translate-y-0.5 active:translate-y-px
                        active:shadow-none disabled:opacity-50"
                    >
                      {isRestoring ? "restoring..." : "restore"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Speed-dial FAB — portalled to body to escape PageTransition transform stacking context */}
        {isMounted &&
          createPortal(
            <div
              className="fixed right-4 bottom-[76px] z-[2] flex flex-col
                items-end gap-2"
            >
              {fabOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setFabOpen(false);
                      setSelectedNote(null);
                      setIsNotesOpen(true);
                    }}
                    className="dark:border-border flex items-center gap-2
                      rounded-full border border-slate-300 bg-yellow-300 px-4
                      py-2.5 text-sm font-semibold text-slate-700 transition
                      active:translate-y-px active:dark:bg-yellow-500
                      dark:text-slate-600
                      dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
                  >
                    <Plus className="size-3" /> note
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFabOpen(false);
                      setEditingAccount(null);
                      setIsAccountDialogOpen(true);
                    }}
                    className="dark:border-border flex items-center gap-2
                      rounded-full border border-slate-300 bg-emerald-300 px-4
                      py-2.5 text-sm font-semibold text-slate-700 transition
                      active:translate-y-px active:dark:bg-emerald-600
                      dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
                  >
                    <Plus className="size-3" /> loan
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setFabOpen((v) => !v)}
                aria-label={fabOpen ? "Close actions" : "Open actions"}
                className={`dark:border-border dark:text-background flex size-14
                items-center justify-center rounded-full border-slate-300
                text-slate-600 transition-all duration-300 active:scale-95
                dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)] ${
                  fabOpen
                    ? "rotate-45 bg-red-400 dark:bg-red-500"
                    : "bg-green-300 dark:bg-green-400"
                }`}
              >
                <Plus className="size-5" />
              </button>
            </div>,
            document.body,
          )}

        <Dialog
          open={isAccountDialogOpen}
          onOpenChange={(open) => {
            setIsAccountDialogOpen(open);
            if (!open) setEditingAccount(null);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="gap-3 pb-2">
              <div
                className="flex h-10 w-10 items-center justify-center
                  rounded-full bg-indigo-100 text-indigo-700
                  dark:bg-indigo-900/40 dark:text-indigo-300"
              >
                {editingAccount ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <Wallet className="h-5 w-5" />
                )}
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {editingAccount ? "Edit Account" : "Add Account"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {editingAccount
                    ? "Update the account details and payment schedule."
                    : "Create a new loan or cash advance for this borrower."}
                </DialogDescription>
              </div>
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
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>

        <ActivateAccountDialog
          open={Boolean(activatingAccount)}
          onClose={() => setActivatingAccount(null)}
          accountId={activatingAccount?.id ?? ""}
          initialValues={
            activatingAccount
              ? {
                  principal_amount: Number(
                    activatingAccount.principal_amount ?? 0,
                  ),
                  interest_rate: Number(activatingAccount.interest_rate ?? 0),
                  release_date: activatingAccount.release_date ?? "",
                  first_payment_date:
                    activatingAccount.first_payment_date ?? "",
                  payment_frequency:
                    (activatingAccount.payment_frequency as any) ?? "bimonthly",
                  term_months: Number(activatingAccount.term_months ?? 1),
                  schedule_mode:
                    (activatingAccount.schedule_mode as any) ?? "auto",
                  interest_type:
                    (activatingAccount.interest_type as any) ?? "flat",
                }
              : {}
          }
        />

        {/* <NotesCanvas borrowerId={borrowerId} initialData={borrower?.notes_canvas} /> */}
        <motion.div
          className="mt-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={notesVariants}
        >
          {notes.length === 0 ? null : (
            <motion.div
              className="mb-4"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{
                type: "spring" as const,
                stiffness: 300,
                damping: 25,
              }}
            >
              <h2 className="text-xl font-black uppercase">Notes</h2>
            </motion.div>
          )}

          <motion.div
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={cardContainerVariants}
          >
            {notes.map((note) => (
              <motion.button
                key={note.id}
                onClick={() => {
                  setSelectedNote(note);
                  setIsNotesOpen(true);
                }}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.98 }}
                className="relative aspect-[9/16] w-full overflow-hidden
                  rounded-sm shadow-md"
              >
                {note.preview_img_url ? (
                  <img
                    src={
                      resolvedTheme === "dark"
                        ? (note.preview_img_url as string).replace(
                            /\.webp$/,
                            "-dark.webp",
                          )
                        : (note.preview_img_url as string)
                    }
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        note.preview_img_url as string;
                    }}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center
                      bg-slate-100"
                  >
                    <span className="text-xs text-slate-400">No preview</span>
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
          <DialogContent
            className="top-0 h-[100svh] max-h-[100svh] max-w-full translate-y-0
              rounded-none sm:top-1/2 sm:h-auto sm:max-h-[95svh] sm:max-w-5xl
              sm:-translate-y-1/2 sm:rounded-xl"
          >
            <div className="mt-10 flex items-center justify-between">
              <DialogHeader className="">
                <DialogTitle>
                  {selectedNote ? "Edit note" : "New note"}
                </DialogTitle>
              </DialogHeader>

              {selectedNote && (
                <button
                  onClick={() => deleteNote(selectedNote.id)}
                  className="rounded-md border border-red-200 bg-red-50 px-3
                    py-1 text-sm text-red-600 hover:bg-red-100"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <NotesCanvas
                borrowerId={borrowerId}
                note={selectedNote}
                draft={
                  noteDraftsRef.current[selectedNote?.id ?? "__new__"] ?? null
                }
                onDraftChange={(json) => {
                  noteDraftsRef.current[selectedNote?.id ?? "__new__"] = json;
                }}
                onSaved={() => {
                  delete noteDraftsRef.current[selectedNote?.id ?? "__new__"];
                  invalidateBorrowerDetails(borrowerId);
                  setIsNotesOpen(false);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
