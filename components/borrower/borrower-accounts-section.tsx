"use client";

import { Wallet, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  accountRowToFormInitial,
  type AccountEditableRow,
} from "@/components/forms/account-form-initial";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Sheet } from "@/components/dashboard/checklist-v2/sheet";
import { BorrowerSummary } from "./borrower-detail-view";
import { supabase } from "@/lib/supabase/client";
import { wasQueuedOffline } from "@/lib/checklist/offline-cache";
import {
  revalidateBorrowerDetailPage,
  revalidateDeletedPage,
} from "@/lib/actions/borrowers";
import {
  useBorrowerDetails,
  useInvalidateBorrowerDetails,
} from "@/lib/hooks/use-borrower-details";
import dynamic from "next/dynamic";
import {
  AccountForm,
  loadAccountForm,
} from "@/components/forms/account-form-loader";

const NotesCanvas = dynamic(() => import("./notes-canvas"), { ssr: false });
// Only needed once a dialog or the notes grid is actually shown.
const loadActivateDialog = () => import("./activate-account-dialog");
const ActivateAccountDialog = dynamic(loadActivateDialog);
const SortableNotesGrid = dynamic(() => import("./sortable-notes-grid"));
import { AccountRow as AccountRowItem, type RowActions } from "./account-row";
import {
  SwipeableList,
  type SwipeAction,
  type SwipeableListValue,
} from "@/components/motion/swipeable-list";
import { BorrowerBand } from "./borrower-band";
import { GROUP_STYLES } from "./group-styles";
import { bandFigures } from "@/lib/borrower/band-figures";
import { HIDDEN_AMOUNT, useHideAmounts } from "@/lib/hide-amounts";
import type { InstallmentDot } from "@/lib/payment-schedule/installment-dots";
import {
  prunePendingAccounts,
  readPendingAccounts,
  markBorrowerForRefresh,
  subscribePendingAccounts,
  wasMadeOffline,
  type PendingAccount,
} from "@/lib/offline/pending-accounts";
import { m } from "motion/react";
import { cleanUpChecklistAfterDelete } from "@/lib/checklist/account-cleanup";

/** History-entry state key holding the scroll position to return to. */
const SCROLL_STATE_KEY = "__lendzBorrowerScroll";

/**
 * Scrolls to `y` and holds it there for a moment: right after a back
 * navigation the page is still settling (it can be shorter than `y` at first,
 * and its height changes as it finishes rendering), which would otherwise
 * clamp or shift the position. Gives up the instant the user scrolls or taps.
 * Returns a cleanup that cancels it.
 */
function restoreScrollTo(y: number) {
  const HOLD_MS = 1500;
  const inputEvents = ["wheel", "touchstart", "keydown", "pointerdown"];
  let frame = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    inputEvents.forEach((e) => window.removeEventListener(e, stop));
  };
  inputEvents.forEach((e) =>
    window.addEventListener(e, stop, { passive: true }),
  );
  const startedAt = performance.now();
  const hold = () => {
    if (stopped) return;
    if (Math.abs(window.scrollY - y) >= 1) window.scrollTo(0, y);
    if (performance.now() - startedAt > HOLD_MS) {
      stop();
      return;
    }
    frame = requestAnimationFrame(hold);
  };
  hold();
  return stop;
}

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
};

export type AccountRow = AccountEditableRow & {
  id: string;
  borrower_id: string;
  status: string;
  first_payment_date: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  /** Created while offline or on a slow connection; not on the server yet. */
  pendingSync?: boolean;
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
  /** Every installment, for the schedule dots; absent in older cached data. */
  installments?: InstallmentDot[];
  overdueCount: number;
  overdueTotal: number;
  overdueSchedules: { due_date: string; amount: number }[];
  totalDue: number;
  totalPaid: number;
  amountPaidThisMonth: number;
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
  initialNotes?: Record<string, unknown>[] | null;
};

export default function BorrowerAccountsSection({
  borrowerId,
  accounts: serverAccounts,
  borrower,
  initialMetrics,
  deletedAccounts = [],
  initialNotes,
}: BorrowerAccountsSectionProps) {
  const [hide, toggleHide] = useHideAmounts();
  // The account whose swipe actions are showing; opening one closes the rest.
  const [openSwipe, setOpenSwipe] = useState<SwipeableListValue | null>(null);
  const closeSwipe = useCallback(() => setOpenSwipe(null), []);
  // Edit and Activate open dialogs whose code is split off: fetch it once the
  // page is idle, and again as soon as a row is swiped open (a no-op after the
  // first), so the dialog has its form the moment it opens.
  useEffect(() => {
    const load = () => {
      void loadAccountForm();
      void loadActivateDialog();
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(load);
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (openSwipe) void loadAccountForm();
  }, [openSwipe]);
  // What each row's Revert and Delete open, listed by the rows themselves.
  const rowActions = useRef(new Map<string, RowActions>());
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [openingAccountId, setOpeningAccountId] = useState<string | null>(null);
  const [activatingAccount, setActivatingAccount] = useState<AccountRow | null>(
    null,
  );
  const router = useRouter();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();

  // Accounts created offline show up right away, tagged as syncing, until the
  // server's own list includes them.
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  useEffect(() => {
    const load = () => setPendingAccounts(readPendingAccounts(borrowerId));
    load();
    return subscribePendingAccounts(load);
  }, [borrowerId]);
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
          accounts: (serverAccounts as any[]) ?? [],
          metrics: (initialMetrics as any) ?? {},
          notes: initialNotes ?? undefined,
        }
      : undefined,
  );
  // An account made offline counts as arrived once either the rendered list
  // or the fetched one has it (the rendered one sits in a server cache), and
  // the fetched copy stands in until the rendered list catches up. Only for
  // those accounts: anything else the fetched list has may just be stale,
  // like an account that was deleted a moment ago.
  const fetchedAccounts = queryData?.accounts as AccountRow[] | undefined;
  useEffect(() => {
    if (!serverAccounts && !fetchedAccounts) return;
    prunePendingAccounts(
      borrowerId,
      new Set([
        ...(serverAccounts ?? []).map((a) => a.id),
        ...(fetchedAccounts ?? []).map((a) => a.id),
      ]),
    );
  }, [serverAccounts, fetchedAccounts, borrowerId]);
  const accounts = useMemo(() => {
    if (!serverAccounts) return serverAccounts;
    const have = new Set(serverAccounts.map((a) => a.id));
    const fetchedExtra = (fetchedAccounts ?? []).filter(
      (a) => wasMadeOffline(a.id) && !have.has(a.id),
    );
    fetchedExtra.forEach((a) => have.add(a.id));
    const pendingExtra = pendingAccounts.filter((p) => !have.has(p.id));
    const extra = [
      ...fetchedExtra,
      ...(pendingExtra as unknown as AccountRow[]),
    ];
    return extra.length > 0 ? [...serverAccounts, ...extra] : serverAccounts;
  }, [serverAccounts, fetchedAccounts, pendingAccounts]);
  const { resolvedTheme } = useTheme();
  const notes = (queryData?.notes ?? []) as any[];
  const accountMetricsById = (queryData?.metrics ??
    initialMetrics ??
    {}) as Record<string, AccountComputedMetrics>;

  // Each kind of account in its own list, soonest due first. Recomputed only
  // when the accounts or their metrics change, not on every render.
  const groupedAccounts = useMemo(() => {
    const list = accounts ?? [];
    const dueTime = (a: AccountRow) => {
      const date = accountMetricsById[a.id]?.nextCollectionDate;
      return date ? new Date(date).getTime() : Infinity;
    };
    const bucket = (
      pending: boolean,
      cash: boolean,
      mode: "auto" | "flat" | "rolling",
    ) =>
      list
        .filter((a) => {
          const manual = a.schedule_mode === "manual";
          const rolling = manual && a.interest_type === "rolling";
          return (
            (a.status === "pending") === pending &&
            (a.type === "cash_advance") === cash &&
            (mode === "auto"
              ? !manual
              : mode === "rolling"
                ? rolling
                : manual && !rolling)
          );
        })
        .sort((a, b) => dueTime(a) - dueTime(b));
    return {
      activeAutoLoans: bucket(false, false, "auto"),
      activeManualFlatLoans: bucket(false, false, "flat"),
      activeManualRollingLoans: bucket(false, false, "rolling"),
      activeAutoCashAdvances: bucket(false, true, "auto"),
      activeManualFlatCashAdvances: bucket(false, true, "flat"),
      activeManualRollingCashAdvances: bucket(false, true, "rolling"),
      pendingAutoAll: [
        ...bucket(true, false, "auto"),
        ...bucket(true, true, "auto"),
      ],
      pendingManualFlatAll: [
        ...bucket(true, false, "flat"),
        ...bucket(true, true, "flat"),
      ],
      pendingManualRollingAll: [
        ...bucket(true, false, "rolling"),
        ...bucket(true, true, "rolling"),
      ],
    };
  }, [accounts, accountMetricsById]);
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [permaDeletingIds, setPermaDeletingIds] = useState<Set<string>>(
    new Set(),
  );
  const [isClearingDeleted, setIsClearingDeleted] = useState(false);
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
    // Park the scroll position on this history entry, so coming back to it
    // lands in the same place (a fresh visit has no such state).
    try {
      window.history.replaceState(
        { ...window.history.state, [SCROLL_STATE_KEY]: window.scrollY },
        "",
      );
    } catch {
      // History unavailable — back just opens at the top
    }
    setOpeningAccountId(id);
    router.push(`/accounts/${id}`);
  };

  // Back from an account page, return to where this history entry was left
  // (or the top for a fresh visit), before anything is painted.
  useLayoutEffect(() => {
    const y = window.history.state?.[SCROLL_STATE_KEY];
    if (typeof y !== "number") {
      window.scrollTo(0, 0);
      return;
    }
    return restoreScrollTo(y);
  }, []);

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

      if (wasQueuedOffline(error)) {
        markBorrowerForRefresh(borrowerId);
        clearSelection();
        toast.info(
          `Saved offline — ${ids.length} account${ids.length === 1 ? "" : "s"} will be deleted when you're back online.`,
        );
        return;
      }
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        `Deleted ${ids.length} account${ids.length === 1 ? "" : "s"}`,
      );
      await cleanUpChecklistAfterDelete(ids);
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
      await revalidateDeletedPage();
      router.refresh();
    } finally {
      setRestoringIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const handlePermaDeleteAccount = async (accountId: string) => {
    const confirmed = window.confirm(
      "Permanently delete this account? This cannot be undone.",
    );
    if (!confirmed) return;

    setPermaDeletingIds((prev) => new Set(prev).add(accountId));
    try {
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", accountId);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Account permanently deleted");
      await revalidateBorrowerDetailPage(borrowerId);
      await revalidateDeletedPage();
      router.refresh();
    } finally {
      setPermaDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const handleClearAllDeletedAccounts = async () => {
    if (deletedAccounts.length === 0) return;

    const confirmed = window.confirm(
      `Permanently delete all ${deletedAccounts.length} deleted account${
        deletedAccounts.length === 1 ? "" : "s"
      }? This cannot be undone.`,
    );
    if (!confirmed) return;

    setIsClearingDeleted(true);
    try {
      const ids = deletedAccounts.map((a) => a.id);
      const { error } = await supabase.from("accounts").delete().in("id", ids);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        `Permanently deleted ${ids.length} account${
          ids.length === 1 ? "" : "s"
        }`,
      );
      await revalidateBorrowerDetailPage(borrowerId);
      await revalidateDeletedPage();
      router.refresh();
    } finally {
      setIsClearingDeleted(false);
    }
  };
  const handlePrefetchAccount = (id: string) => {
    router.prefetch(`/accounts/${id}`);
  };

  // The cards are memoized, so they get handlers that keep one identity. They
  // call through to the latest version of each function, set after each render.
  const latestHandlers = useRef({
    open: handleOpenAccount,
    prefetch: handlePrefetchAccount,
    toggleSelect: toggleAccountSelection,
  });
  useEffect(() => {
    latestHandlers.current = {
      open: handleOpenAccount,
      prefetch: handlePrefetchAccount,
      toggleSelect: toggleAccountSelection,
    };
  });
  const stableOpenAccount = useCallback(
    (id: string) => latestHandlers.current.open(id),
    [],
  );
  const stablePrefetchAccount = useCallback(
    (id: string) => latestHandlers.current.prefetch(id),
    [],
  );
  const stableToggleSelect = useCallback(
    (id: string) => latestHandlers.current.toggleSelect(id),
    [],
  );
  // The sheet opens once the form's code is here (right away when it was
  // fetched ahead), so it never shows a loading placeholder.
  const openAccountSheet = useCallback((account: AccountRow | null) => {
    setEditingAccount(account);
    loadAccountForm()
      .then(() => setIsAccountDialogOpen(true))
      .catch(() =>
        toast.error("couldn't open the form. check your connection."),
      );
  }, []);
  const stableEditAccount = openAccountSheet;
  // Behind each row: what the three-dot menu used to offer.
  const accountById = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a])),
    [accounts],
  );
  const swipeActions = useMemo<SwipeAction[]>(
    () => [
      {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="size-4" />,
        tone: "primary",
        onClick: (item) => {
          const account = accountById.get(item.id);
          if (account) stableEditAccount(account);
        },
      },
      {
        id: "revert",
        label: "Revert last update",
        icon: <RotateCcw className="size-4" />,
        tone: "warning",
        onClick: (item) => rowActions.current.get(item.id)?.revert(),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        tone: "danger",
        onClick: (item) => rowActions.current.get(item.id)?.remove(),
      },
    ],
    [accountById, stableEditAccount],
  );

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
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const amountToPayThisMonth = accounts.reduce((sum, account) => {
      const m = accountMetricsById[account.id];
      if (!m || account.status === "pending") return sum;

      let accountDue = 0;
      // Include any current or overdue scheduled collection (partials + next pending)
      for (const nc of m.nextCollections ?? []) {
        if (!nc.due_date || nc.amount <= 0) continue;
        const due = new Date(nc.due_date);
        if (
          due.getFullYear() < currentYear ||
          (due.getFullYear() === currentYear && due.getMonth() <= currentMonth)
        ) {
          accountDue += nc.amount;
        }
      }

      // Manual-flat accounts have no generated schedules, so the full remaining balance is due
      if (
        accountDue === 0 &&
        m.amountLeftToPay > 0 &&
        account.schedule_mode === "manual" &&
        account.interest_type !== "rolling"
      ) {
        accountDue += m.amountLeftToPay;
      }

      return sum + accountDue;
    }, 0);
    const amountPaidThisMonth = accounts.reduce(
      (sum, account) =>
        sum + (accountMetricsById[account.id]?.amountPaidThisMonth ?? 0),
      0,
    );
    return {
      totalLoaned,
      totalExpected,
      totalCollected,
      totalAmountCollected,
      totalRemaining,
      profitPerSchedule,
      collectedPct,
      amountToPayThisMonth,
      amountPaidThisMonth,
    };
  }, [accounts, accountMetricsById]);

  const figures = useMemo(
    () => bandFigures(accounts ?? [], accountMetricsById),
    [accounts, accountMetricsById],
  );

  const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-US")}`;
  const renderGroup = (group: AccountRow[], label: string) =>
    group.length === 0 ? null : (
      <div key={label}>
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 text-xs font-bold lowercase",
            GROUP_STYLES[label]?.badge,
          )}
        >
          {label}
          <span className="opacity-70 tabular-nums">{group.length}</span>
        </div>
        <SwipeableList
          items={group.map((account) => ({
            id: account.id,
            // Selecting turns the swipe off.
            rightActions: selectionMode ? [] : swipeActions,
          }))}
          value={openSwipe}
          onValueChange={setOpenSwipe}
          actionWidth={52}
          className="gap-0 divide-y divide-border"
          classNames={{
            item: "rounded-none",
            rail: "rounded-none",
            surface: "min-h-0 rounded-none border-0 bg-card p-0 shadow-none",
          }}
          renderItem={(item) => {
            const account = accountById.get(item.id);
            if (!account) return null;
            return (
              <AccountRowItem
                account={account}
                group={label}
                hide={hide}
                isOpening={openingAccountId === account.id}
                onOpen={stableOpenAccount}
                onPrefetch={stablePrefetchAccount}
                onActivate={setActivatingAccount}
                metrics={accountMetricsById[account.id]}
                selectionMode={selectionMode}
                selected={selectedAccountIds.has(account.id)}
                onToggleSelect={stableToggleSelect}
                swiped={openSwipe?.id === account.id}
                onClose={closeSwipe}
                actions={rowActions}
              />
            );
          }}
        />
      </div>
    );

  // The add button on the accounts card (and its empty state): the page's one
  // way in to a new loan, now the floating button is gone.
  const hasAccounts = Boolean(accounts && accounts.length > 0);

  const addLoanButton = (
    <button
      type="button"
      data-tour="borrower-add"
      onPointerDown={() => void loadAccountForm()}
      onClick={() => openAccountSheet(null)}
      className="ml-auto flex items-center gap-1 rounded-full bg-emerald-100
        px-3 py-1.5 text-xs font-bold text-emerald-700 active:bg-emerald-200
        dark:bg-emerald-500/20 dark:text-emerald-300"
    >
      <Plus className="size-3.5" aria-hidden="true" /> add
    </button>
  );

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pb-16">
        {borrower && (
          <BorrowerBand
            borrower={borrower}
            figures={figures}
            loaned={summaryStats?.totalLoaned ?? 0}
            hide={hide}
            onToggleHide={toggleHide}
            stats={{
              profitExpected: Math.max(0, summaryStats?.totalExpected ?? 0),
              profitCollected: Math.max(0, summaryStats?.totalCollected ?? 0),
              toPayThisMonth: summaryStats?.amountToPayThisMonth ?? 0,
              paidThisMonth: summaryStats?.amountPaidThisMonth ?? 0,
            }}
          />
        )}

        {/* Floats over the band's lower edge; the band's header caps it on
            scroll (see BorrowerBand). */}
        <div
          className={cn(
            "relative z-10 space-y-5 px-1",
            borrower ? "-mt-8 sm:-mt-12" : "mt-6",
          )}
          data-settle-group
        >
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
              className="rounded-lg border-2 border-red-500 bg-red-50 p-4
                text-sm font-bold text-red-700"
            >
              {queryError instanceof Error
                ? queryError.message
                : "Failed to load borrower details."}
            </div>
          )}

          {selectionMode && (
            <div
              className="dark:border-border dark:bg-card sticky top-16 z-20
                -mx-5 border-y border-slate-300 bg-white px-5 py-2 shadow-sm
                sm:top-[68px]"
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
                      active:translate-y-px"
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBulkDeleting}
                    onClick={handleBulkDelete}
                    className="rounded-lg border border-slate-300 bg-red-400
                      px-3 py-1 text-xs font-bold text-white transition
                      active:translate-y-px disabled:opacity-50
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

          {/* With no accounts the card still shows, like the notes card, so
              a first one can be added from it. */}
          <div
            className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1
              ring-black/5 dark:ring-white/10"
          >
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <span
                className="flex size-8 shrink-0 items-center justify-center
                  rounded-full bg-violet-100 text-violet-700
                  dark:bg-violet-500/20 dark:text-violet-300"
              >
                <Wallet className="size-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-black text-card-foreground/80
                lowercase">
                accounts
              </h2>
              {hasAccounts && (
                <span
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px]
                    font-bold text-muted-foreground tabular-nums"
                >
                  {accounts?.length}
                </span>
              )}
              {addLoanButton}
            </div>
            {!hasAccounts && (
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onPointerDown={() => void loadAccountForm()}
                  onClick={() => openAccountSheet(null)}
                  className="flex w-full flex-col items-center justify-center
                    gap-1 rounded-xl border-2 border-dashed border-border py-6
                    text-center transition active:scale-[0.99]
                    active:bg-muted/50"
                >
                  <Plus
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-muted-foreground">
                    Add an account
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    A loan or cash advance for this borrower
                  </span>
                </button>
              </div>
            )}
            {renderGroup(groupedAccounts.activeAutoLoans, "loans")}
            {renderGroup(
              groupedAccounts.activeManualFlatLoans,
              "manual flat loans",
            )}
            {renderGroup(
              groupedAccounts.activeManualRollingLoans,
              "manual rolling loans",
            )}
            {renderGroup(
              groupedAccounts.activeAutoCashAdvances,
              "cash advances",
            )}
            {renderGroup(
              groupedAccounts.activeManualFlatCashAdvances,
              "manual flat cash advances",
            )}
            {renderGroup(
              groupedAccounts.activeManualRollingCashAdvances,
              "manual rolling cash advances",
            )}
            {renderGroup(groupedAccounts.pendingAutoAll, "pending")}
            {renderGroup(
              groupedAccounts.pendingManualFlatAll,
              "manual flat pending",
            )}
            {renderGroup(
              groupedAccounts.pendingManualRollingAll,
              "manual rolling pending",
            )}
          </div>

          <Sheet
            open={isAccountDialogOpen}
            onClose={() => {
              setIsAccountDialogOpen(false);
              setEditingAccount(null);
            }}
            label={editingAccount ? "Edit account" : "Add account"}
          >
            <AccountForm
              key={`${borrowerId}-${editingAccount?.id ?? "new"}`}
              borrowerId={borrowerId}
              borrowerName={
                borrower
                  ? `${borrower.first_name} ${borrower.last_name}`.trim()
                  : undefined
              }
              accountId={editingAccount?.id}
              initialValues={
                editingAccount
                  ? accountRowToFormInitial(editingAccount)
                  : undefined
              }
              onSuccess={async () => {
                setIsAccountDialogOpen(false);
                setEditingAccount(null);
                await invalidateBorrowerDetails(borrowerId);
                router.refresh();
              }}
            />
          </Sheet>

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
                      (activatingAccount.payment_frequency as any) ??
                      "bimonthly",
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
          {/* A plain wrapper: the page's settle-in (see globals.css) already
              brings each card in, and a second animation here fought it. */}
          <div>
            <SortableNotesGrid
              notes={notes}
              borrowerId={borrowerId}
              resolvedTheme={resolvedTheme ?? "light"}
              onNoteClick={(note) => {
                setSelectedNote(note);
                setIsNotesOpen(true);
              }}
              onAddNote={() => {
                setSelectedNote(null);
                setIsNotesOpen(true);
              }}
            />
          </div>

          {deletedAccounts.length > 0 && (
            <div
              className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1
                ring-black/5 dark:ring-white/10"
            >
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <span
                  className="flex size-8 shrink-0 items-center justify-center
                    rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20
                    dark:text-rose-300"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </span>
                <h2
                  className="text-sm font-black text-card-foreground/80
                    lowercase"
                >
                  recently deleted
                </h2>
                <span
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px]
                    font-bold text-muted-foreground tabular-nums"
                >
                  {deletedAccounts.length}
                </span>
                <button
                  type="button"
                  disabled={isClearingDeleted}
                  onClick={handleClearAllDeletedAccounts}
                  className="ml-auto rounded-full bg-rose-100 px-3 py-1.5
                    text-xs font-bold text-rose-700 active:bg-rose-200
                    disabled:opacity-50 dark:bg-rose-500/20 dark:text-rose-300"
                >
                  {isClearingDeleted ? "clearing…" : "clear all"}
                </button>
              </div>

              <div className="divide-y divide-border">
                {deletedAccounts.map((account) => {
                  const isRestoring = restoringIds.has(account.id);
                  const isPermaDeleting = permaDeletingIds.has(account.id);
                  const principal = Number(account.principal_amount ?? 0);
                  const deletedDate = account.deleted_at
                    ? formatDate(account.deleted_at.slice(0, 10))
                    : null;
                  const isManual = account.schedule_mode === "manual";
                  const isRolling =
                    isManual && account.interest_type === "rolling";
                  // The same icon and colour its group had in the list above.
                  const kind =
                    account.type === "cash_advance" ? "cash advances" : "loans";
                  const style =
                    GROUP_STYLES[
                      isManual
                        ? `manual ${isRolling ? "rolling" : "flat"} ${kind}`
                        : kind
                    ];
                  const Icon = style?.icon;
                  const terms = [
                    account.interest_rate ? `${account.interest_rate}%` : null,
                    isManual
                      ? isRolling
                        ? "manual rolling"
                        : "manual flat"
                      : account.payment_frequency,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <m.div
                      key={account.id}
                      variants={cardVariants}
                      // Each row animates itself, so one deleted while the
                      // page is open comes in too.
                      initial="hidden"
                      animate="visible"
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className={cn(
                          `flex size-10 shrink-0 items-center justify-center
                          rounded-full opacity-60`,
                          style?.badge ?? "bg-slate-100 text-slate-600",
                        )}
                      >
                        {Icon && <Icon className="size-4" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[22px] leading-tight font-black
                            tracking-tight text-card-foreground/45 line-through
                            decoration-rose-400/70 decoration-2 tabular-nums"
                        >
                          ₱{principal.toLocaleString()}
                        </p>
                        <p
                          className="truncate text-xs font-semibold
                            text-muted-foreground"
                        >
                          {terms}
                        </p>
                        {deletedDate && (
                          <p
                            className="truncate text-xs font-bold text-rose-500
                              lowercase dark:text-rose-300"
                          >
                            deleted {deletedDate}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={() => handleRestoreAccount(account.id)}
                          className="flex size-9 items-center justify-center
                            rounded-full bg-emerald-100 text-emerald-700
                            active:bg-emerald-200 disabled:opacity-50
                            dark:bg-emerald-500/20 dark:text-emerald-300"
                          aria-label="Restore account"
                        >
                          {isRestoring ? (
                            <span
                              className="inline-block size-4 animate-spin
                                rounded-full border-2 border-current
                                border-t-transparent"
                            />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isPermaDeleting}
                          onClick={() => handlePermaDeleteAccount(account.id)}
                          className="flex size-9 items-center justify-center
                            rounded-full bg-rose-100 text-rose-700
                            active:bg-rose-200 disabled:opacity-50
                            dark:bg-rose-500/20 dark:text-rose-300"
                          aria-label="Permanently delete account"
                        >
                          {isPermaDeleting ? (
                            <span
                              className="inline-block size-4 animate-spin
                                rounded-full border-2 border-current
                                border-t-transparent"
                            />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </div>
                    </m.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last and out of the flow, so showing it never moves the cards or
              changes which settle delay each one gets. */}
          {isFetching && queryData && (
            <div
              role="status"
              className="pointer-events-none absolute -top-7 right-2 flex
                items-center gap-1.5 rounded-full bg-black/25 px-2 py-0.5
                backdrop-blur-sm"
            >
              <span
                className="inline-block size-1.5 animate-pulse rounded-full
                  bg-emerald-300"
              />
              <span className="text-[10px] font-bold text-white lowercase">
                refreshing…
              </span>
            </div>
          )}
        </div>

        <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
          <DialogContent
            // dvh tracks the visible viewport as mobile toolbars show/hide;
            // svh is the smallest size and left a gap at the bottom.
            // Full screen on a phone (edge to edge, clear of the notch and
            // home bar); a large centred window on wider screens.
            className="top-0 h-dvh max-h-dvh max-w-full translate-y-0 gap-2
              rounded-none border-0 p-2
              pt-[max(env(safe-area-inset-top),0.75rem)]
              pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:top-1/2
              sm:h-[95dvh] sm:max-h-[95dvh] sm:max-w-5xl sm:-translate-y-1/2
              sm:gap-4 sm:rounded-xl sm:border sm:p-6"
          >
            {/* Shares the top row with the dialog's close button (top-right) */}
            <div
              className="flex min-h-8 items-center justify-between pr-10 pl-1"
            >
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
