"use client";

import { FaPlus } from "react-icons/fa6";
import { ChevronDown, ArrowLeft } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
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
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  nextCollectionsForDisplay,
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import dynamic from "next/dynamic";

const NotesCanvas = dynamic(() => import("./notes-canvas"), { ssr: false });
import NeobrutButton from "../neobrut-button";
import BorrowerDetailMenu from "./borrower-detail-menu";
import ActivateAccountDialog from "./activate-account-dialog";
import { isDarkColor } from "@/lib/utils";
import { AccountCard } from "./account-card";
import { motion } from "framer-motion";

const stripVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 25 },
  },
};

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

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
    <>
      <div className="bg-background/95 dark:bg-background/95 fixed top-10 right-0 left-0 z-30 border sm:top-18 md:top-16">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="dark:text-foreground truncate text-sm font-black tracking-wide text-slate-900 uppercase">
                {borrower.first_name} {borrower.last_name}
              </p>
              {borrower.category && borrower.category.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {borrower.category.map((c) => (
                    <span
                      key={c.id}
                      className={`rounded border border-slate-900/30 px-1.5 py-0.5 text-[9px] font-black ${isDarkColor(c.color) ? "text-white" : "text-slate-900"}`}
                      style={{ backgroundColor: c.color }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="dark:text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                <span>
                  Loaned{" "}
                  <strong className="dark:text-foreground text-slate-700">
                    ₱{Math.round(totalLoaned).toLocaleString()}
                  </strong>
                </span>
                <span>
                  Collected{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    ₱{Math.round(totalAmountCollected).toLocaleString()}
                  </strong>
                </span>
                <span>
                  Remaining{" "}
                  <strong className="text-rose-700 dark:text-rose-400">
                    ₱{Math.round(totalRemaining).toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
            <ChevronDown
              className={`dark:text-muted-foreground ml-1 size-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
          <div className="ml-2 shrink-0" data-prevent-strip-open>
            <BorrowerDetailMenu borrowerId={borrower.id} />
          </div>
        </div>
        <div
          className={`bg-background/95 dark:bg-background/95 absolute top-full right-0 left-0 z-30 overflow-hidden border-x-2 border-b-2 border-slate-900 shadow-[0_4px_0px_0px_#0f172a] backdrop-blur transition-all duration-300 ease-out dark:border-[#020617] dark:shadow-[0_4px_0px_0px_#020617] ${open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pt-2 pb-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {(
                [
                  {
                    label: "Total Loaned",
                    value: totalLoaned,
                    bg: "bg-sky-100 dark:bg-sky-900/30",
                  },
                  {
                    label: "Money Collected",
                    value: totalAmountCollected,
                    bg: "bg-teal-100 dark:bg-teal-900/30",
                  },
                  {
                    label: "Remaining",
                    value: totalRemaining,
                    bg: "bg-rose-100 dark:bg-rose-900/30",
                  },
                  {
                    label: "Profit Expected",
                    value: totalExpected,
                    bg: "bg-amber-100 dark:bg-amber-900/30",
                  },
                  {
                    label: "Profit Collected",
                    value: totalCollected,
                    bg: "bg-emerald-100 dark:bg-emerald-900/30",
                  },
                  {
                    label: "Profit / Schedule",
                    value: profitPerSchedule,
                    bg: "bg-violet-100 dark:bg-violet-900/30",
                  },
                ] as const
              ).map(({ label, value, bg }) => (
                <div
                  key={label}
                  className={`border-2 border-slate-900 ${bg} px-2 py-1.5 shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617]`}
                >
                  <p className="dark:text-muted-foreground font-black tracking-wide text-slate-500 uppercase">
                    {label}
                  </p>
                  <p className="dark:text-foreground mt-0.5 font-black text-slate-900 tabular-nums">
                    ₱{Math.round(value).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-sm border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-slate-900">
                <div
                  className="h-full bg-emerald-400 transition-[width] duration-500 ease-out dark:bg-emerald-500"
                  style={{ width: open ? `${collectedPct}%` : "0%" }}
                />
              </div>
              <span className="dark:text-foreground shrink-0 text-[10px] font-black text-slate-700 tabular-nums">
                {collectedPct}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="h-12 sm:h-14" />
    </>
  );
}
export type AccountRow = AccountEditableRow & {
  id: string;
  borrower_id: string;
  status: string;
  first_payment_date: string | null;
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
  const [markingNextPaidScheduleId, setMarkingNextPaidScheduleId] = useState<
    string | null
  >(null);
  const editorRef = useRef<any>(null);
  const router = useRouter();
  const [notes, setNotes] = useState<any[]>([]);
  const [accountMetricsById, setAccountMetricsById] = useState<
    Record<string, AccountComputedMetrics>
  >(initialMetrics ?? {});
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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

    setNotes((prev) => prev.filter((n) => n.id !== id));

    setIsNotesOpen(false);
    setSelectedNote(null);
  };
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

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

  const fetchAccountMetrics = async () => {
    if (!accounts || accounts.length === 0) {
      setAccountMetricsById({});
      return;
    }

    const accountIds = accounts.map((account) => account.id);
    const { data: schedulesData, error } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status",
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
        0,
      );
      const amountPaid = rows.reduce(
        (sum, row) => sum + amountPaidOnInstallment(row),
        0,
      );
      const amountLeftToPayRaw = rows.reduce(
        (sum, row) => sum + remainingOnInstallment(row),
        0,
      );
      const amountLeftToPayRolling = rows
        .filter((row) => row.status !== "partial")
        .reduce((sum, row) => sum + remainingOnInstallment(row), 0);
      const principal = Number(account.principal_amount ?? 0);
      const interestRate = Number(account.interest_rate ?? 0);
      const isManual = account.schedule_mode === "manual";
      const isRolling = isManual && account.interest_type === "rolling";
      const isFlatManual = isManual && !isRolling;
      const manualFlatTotal = isFlatManual
        ? principal * (1 + interestRate / 100)
        : 0;
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
      const nextCollections = nextCollectionsForDisplay(rows).map((r) => ({
        due_date: r.due_date,
        amount: remainingOnInstallment(r),
        amount_due: Math.max(0, Number(r.amount_due ?? 0)),
        status: r.status,
      }));
      const overdueRows = rows.filter(
        (row) => row.status === "overdue" && !isInstallmentFullyPaid(row),
      );
      console.log(account);
      const daysSinceRelease = account.release_date
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(account.release_date).getTime()) /
                86400000,
            ),
          )
        : 0;
      const termMonths = Number(account.term_months) || 0;
      const freq = account.payment_frequency;
      const installments = isManual
        ? Number(account.term_installments) || termMonths || 1
        : freq === "custom"
          ? Number(account.term_installments) || 1
          : freq === "bimonthly"
            ? termMonths * 2 || 1
            : freq === "weekly"
              ? termMonths * 4 || 1
              : termMonths || 1;
      const profitPerSchedule = profitToMake / installments;

      computed[account.id] = {
        amountLeftToPay,
        profitToMake,
        daysSinceRelease,
        profitPerSchedule,
        nextCollectionDate: nextUnpaid?.due_date ?? null,
        nextCollectionAmount: nextUnpaid
          ? remainingOnInstallment(nextUnpaid)
          : 0,
        nextCollectionAmountDue: nextUnpaid
          ? Math.max(0, Number(nextUnpaid.amount_due ?? 0))
          : 0,
        nextCollectionStatus: nextUnpaid?.status ?? null,
        nextUnpaidScheduleId: nextUnpaid?.id ?? null,
        nextCollections,
        overdueCount: overdueRows.length,
        overdueTotal: overdueRows.reduce(
          (sum, row) => sum + remainingOnInstallment(row),
          0,
        ),
        overdueSchedules: [...overdueRows]
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .map((row) => ({
            due_date: row.due_date,
            amount: remainingOnInstallment(row),
          })),
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
  }, [borrowerId]);

  useEffect(() => {
    setAccountMetricsById(initialMetrics ?? {});
  }, [initialMetrics]);

  useEffect(() => {
    fetchAccountMetrics();
  }, [accounts]);

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="rounded-lg">
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

      <div className="pt-3">
        <button
          type="button"
          onClick={() => {
            router.push("/borrowers", { scroll: false });
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="size-3.5" />
          back to borrowers
        </button>
      </div>

      {selectionMode && (
        <div className="dark:border-border dark:bg-card sticky top-[52px] z-40 -mx-4 mb-4 border-y-2 border-slate-900 bg-white px-4 py-2 shadow-sm md:top-[68px]">
          <div className="flex items-center justify-between">
            <span className="dark:text-foreground text-sm font-black text-slate-700">
              {selectedAccountIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="dark:border-border dark:bg-card dark:text-foreground rounded-lg border-2 border-slate-900 bg-white px-3 py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#0f172a] transition hover:-translate-y-0.5 active:translate-y-px active:shadow-none"
              >
                cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
                className="rounded-lg border-2 border-slate-900 bg-red-400 px-3 py-1 text-xs font-bold text-white shadow-[1px_1px_0px_0px_#0f172a] transition hover:-translate-y-0.5 active:translate-y-px active:shadow-none disabled:opacity-50 dark:border-red-500/50 dark:bg-red-500/80"
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
                    className={`rounded-full border-2 border-slate-900 px-2.5 py-1 text-[10px] font-black tracking-widest uppercase shadow-[2px_2px_0px_0px_#0f172a] ${accent}`}
                  >
                    {label}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {group.length} account{group.length === 1 ? "" : "s"}
                  </span>
                </div>
                <motion.div
                  className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
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
            <span className="rounded-full border-2 border-slate-900 bg-red-100 px-2.5 py-1 text-[10px] font-black tracking-widest text-red-800 uppercase shadow-[2px_2px_0px_0px_#0f172a] dark:border-red-400/40 dark:bg-red-400/[0.15] dark:text-red-300">
              recently deleted
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {deletedAccounts.length} account
              {deletedAccounts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {deletedAccounts.map((account) => {
              const isRestoring = restoringIds.has(account.id);
              const principal = Number(account.principal_amount ?? 0);
              return (
                <div
                  key={account.id}
                  className="dark:border-border dark:bg-card flex items-center justify-between rounded-xl border-2 border-slate-900/40 bg-slate-50 px-4 py-3 opacity-70 shadow-[1px_1px_0px_0px_rgb(15_23_42/0.2)] dark:shadow-none"
                >
                  <div>
                    <p className="dark:text-foreground text-sm font-bold text-slate-700">
                      {account.type.replace("_", " ")}
                    </p>
                    <p className="dark:text-muted-foreground text-xs text-slate-500">
                      ₱{principal.toLocaleString()} ·{" "}
                      {account.payment_frequency}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isRestoring}
                    onClick={() => handleRestoreAccount(account.id)}
                    className="dark:border-border dark:bg-card dark:text-foreground rounded-lg border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-bold shadow-[1px_1px_0px_0px_#0f172a] transition hover:-translate-y-0.5 active:translate-y-px active:shadow-none disabled:opacity-50"
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
          <div className="fixed right-4 bottom-[76px] z-[2] flex flex-col items-end gap-2">
            {fabOpen && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFabOpen(false);
                    setSelectedNote(null);
                    setIsNotesOpen(true);
                  }}
                  className="dark:border-border flex items-center gap-2 rounded-full border-2 border-slate-900 bg-yellow-300 px-4 py-2.5 text-sm font-black shadow-[3px_3px_0px_0px_#0f172a] transition active:translate-y-px active:shadow-[1px_1px_0px_0px_#0f172a] dark:bg-yellow-500 dark:text-slate-900 dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
                >
                  <FaPlus className="size-3" /> note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFabOpen(false);
                    setEditingAccount(null);
                    setIsAccountDialogOpen(true);
                  }}
                  className="dark:border-border flex items-center gap-2 rounded-full border-2 border-slate-900 bg-emerald-300 px-4 py-2.5 text-sm font-black shadow-[3px_3px_0px_0px_#0f172a] transition active:translate-y-px active:shadow-[1px_1px_0px_0px_#0f172a] dark:bg-emerald-600 dark:text-white dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
                >
                  <FaPlus className="size-3" /> loan
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setFabOpen((v) => !v)}
              aria-label={fabOpen ? "Close actions" : "Open actions"}
              className={`dark:border-border dark:text-background flex size-14 items-center justify-center rounded-full border-2 border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_rgb(15_23_42/0.4)] transition-all duration-300 active:scale-95 dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)] ${fabOpen ? "rotate-45 bg-red-400 dark:bg-red-500" : "bg-green-300 dark:bg-green-400"}`}
            >
              <FaPlus className="size-5" />
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
                first_payment_date: activatingAccount.first_payment_date ?? "",
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
          {notes.map((note, i) => (
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
              className="relative aspect-[9/16] w-full overflow-hidden rounded-sm shadow-md"
            >
              {note.preview_img_url ? (
                <img
                  src={note.preview_img_url}
                  className="pointer-events-none h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100">
                  <span className="text-xs text-slate-400">No preview</span>
                </div>
              )}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>

      <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
        <DialogContent className="top-0 h-[100svh] max-h-[100svh] max-w-full translate-y-0 rounded-none sm:top-1/2 sm:h-auto sm:max-h-[95svh] sm:max-w-5xl sm:-translate-y-1/2 sm:rounded-xl">
          <div className="mt-10 flex items-center justify-between">
            <DialogHeader className="">
              <DialogTitle>
                {selectedNote ? "Edit note" : "New note"}
              </DialogTitle>
            </DialogHeader>

            {selectedNote && (
              <button
                onClick={() => deleteNote(selectedNote.id)}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <NotesCanvas
              borrowerId={borrowerId}
              note={selectedNote}
              onSaved={(newNote) => {
                if (selectedNote) {
                  setNotes((prev) =>
                    prev.map((n) => (n.id === newNote.id ? newNote : n)),
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
