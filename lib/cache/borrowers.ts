import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { computeBorrowerNextCollectionById } from "@/lib/compute-borrower-next-collection";
import type { Borrower } from "@/components/borrower/borrower-list";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  nextCollectionsForDisplay,
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import type {
  AccountRow,
  AccountComputedMetrics,
} from "@/components/borrower/borrower-accounts-section";

const PAGE_SIZE = 50;

function createSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
}

async function fetchBorrowersPageData(
  currentPage: number,
  searchQuery: string,
  categoryIds: string[],
) {
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createSupabaseAdmin();

  let borrowerIdsWithAccounts: string[] | undefined;
  if (!searchQuery) {
    const { data: accountRows } = await supabase
      .from("accounts")
      .select("borrower_id")
      .not("borrower_id", "is", null)
      .is("deleted_at", null);
    borrowerIdsWithAccounts = [
      ...new Set((accountRows ?? []).map((a) => a.borrower_id).filter(Boolean)),
    ] as string[];
  }

  let query = supabase
    .from("borrowers")
    .select(
      `*, borrower_categories ( category:categories ( id, name, color ) )`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (!searchQuery && borrowerIdsWithAccounts) {
    if (borrowerIdsWithAccounts.length > 0) {
      query = query.in("id", borrowerIdsWithAccounts);
    } else {
      query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    query = query.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},contact.ilike.${pattern}`,
    );
  }

  if (categoryIds.length > 0) {
    const { data: bcRows } = await supabase
      .from("borrower_categories")
      .select("borrower_id")
      .in("category_id", categoryIds);
    const matchingIds = [...new Set((bcRows ?? []).map((r) => r.borrower_id))];
    if (matchingIds.length > 0) {
      query = query.in("id", matchingIds);
    } else {
      query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  const {
    data: borrowerRows,
    error: borrowerError,
    count,
  } = await query.order("created_at", { ascending: false }).range(from, to);

  if (borrowerError) {
    throw borrowerError;
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rawBorrowers = (borrowerRows ?? []) as Borrower[];
  const borrowerIds = rawBorrowers.map((b) => b.id);

  let enrichedBorrowers: Borrower[] = rawBorrowers.map((b) => ({
    ...b,
    has_accounts: false,
    next_collection_date: null,
    next_collection_amount: 0,
  }));

  if (borrowerIds.length > 0) {
    const { data: accountRows } = await supabase
      .from("accounts")
      .select(
        "id, borrower_id, principal_amount, schedule_mode, interest_rate, status, type, interest_type",
      )
      .in("borrower_id", borrowerIds)
      .is("deleted_at", null);

    const accounts = (accountRows ?? []) as Array<{
      id: string;
      borrower_id: string;
      principal_amount: number | null;
      schedule_mode: string | null;
      interest_rate: number | null;
      status: string | null;
      type: string | null;
      interest_type: string | null;
    }>;
    const accountsByBorrower = new Map<string, typeof accounts>();
    for (const a of accounts) {
      const list = accountsByBorrower.get(a.borrower_id) ?? [];
      list.push(a);
      accountsByBorrower.set(a.borrower_id, list);
    }
    const allAccountIds = accounts.map((a) => a.id);
    const accountIdsByBorrower = new Map<string, string[]>();
    for (const a of accounts) {
      const list = accountIdsByBorrower.get(a.borrower_id) ?? [];
      list.push(a.id);
      accountIdsByBorrower.set(a.borrower_id, list);
    }

    if (allAccountIds.length > 0) {
      const { data: scheduleRows } = await supabase
        .from("payment_schedules")
        .select(
          "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status",
        )
        .in("account_id", allAccountIds)
        .order("due_date", { ascending: true })
        .order("id", { ascending: true });

      const schedules = (scheduleRows ?? []) as Array<{
        account_id: string;
        due_date: string;
        amount_due: number | null;
        amount_paid: number | null;
        remaining_amount: number | null;
        status: string;
      }>;
      const overdueByBorrower = new Map<
        string,
        { total: number; count: number }
      >();

      const scheduleStatsByAccount = new Map<
        string,
        {
          total_schedules: number;
          paid_schedules_count: number;
        }
      >();
      const accountToBorrower = new Map<string, string>();

      for (const a of accounts) {
        accountToBorrower.set(a.id, a.borrower_id);
      }
      for (const s of schedules) {
        const borrowerId = accountToBorrower.get(s.account_id);
        if (!borrowerId) continue;
        const stats = scheduleStatsByAccount.get(s.account_id) ?? {
          total_schedules: 0,
          paid_schedules_count: 0,
        };
        scheduleStatsByAccount.set(s.account_id, {
          total_schedules: stats.total_schedules + 1,
          paid_schedules_count:
            stats.paid_schedules_count + (s.status === "paid" ? 1 : 0),
        });
        if (s.status !== "overdue") continue;

        const prev = overdueByBorrower.get(borrowerId) ?? {
          total: 0,
          count: 0,
        };

        overdueByBorrower.set(borrowerId, {
          total: prev.total + (s.amount_due ?? 0),
          count: prev.count + 1,
        });
      }
      const nextById = computeBorrowerNextCollectionById(
        borrowerIds,
        accounts,
        schedules,
      );

      enrichedBorrowers = rawBorrowers.map((b) => {
        const accIds = accountIdsByBorrower.get(b.id) ?? [];
        const borrowerAccounts = accountsByBorrower.get(b.id) ?? [];
        const allPending =
          borrowerAccounts.length > 0 &&
          borrowerAccounts.every((a) => a.status === "pending");
        const pendingPrincipal = allPending
          ? borrowerAccounts.reduce(
              (sum, a) => sum + Number(a.principal_amount ?? 0),
              0,
            )
          : 0;
        const overdue = overdueByBorrower.get(b.id) ?? {
          total: 0,
          count: 0,
        };
        const n = nextById[b.id] ?? {
          next_collection_date: null,
          next_collection_amount: 0,
        };
        return {
          ...b,
          has_accounts: accIds.length > 0,
          all_accounts_pending: allPending,
          pending_principal_total: pendingPrincipal,
          next_collection_date: n.next_collection_date,
          next_collection_amount: n.next_collection_amount,
          next_collection_amounts: n.next_collection_amounts,
          next_collection_status: n.next_collection_status,
          overdue_total: overdue.total,
          overdue_count: overdue.count,
          accounts_count: n.accounts_count,
          account_schedules: n.account_schedules,
          overdue_schedules: n.overdue_schedules,
          manual_total_principal: n.manual_total_principal,
          manual_total_paid: n.manual_total_paid,
          manual_total_remaining: n.manual_total_remaining,
          manual_accounts_count: n.manual_accounts_count,
        };
      });
    } else {
      enrichedBorrowers = rawBorrowers.map((b) => ({
        ...b,
        has_accounts: false,
        all_accounts_pending: false,
        pending_principal_total: 0,
        next_collection_date: null,
        next_collection_amount: 0,
        accounts_count: 0,
      }));
    }
  }

  return {
    borrowers: enrichedBorrowers,
    totalCount,
    totalPages,
  };
}

export const getBorrowersPageData = unstable_cache(
  fetchBorrowersPageData,
  ["borrowers-page"],
  { revalidate: 60, tags: ["borrowers"] },
);

async function fetchBorrowerById(id: string) {
  const supabase = createSupabaseAdmin();

  const { data: borrower, error } = await supabase
    .from("borrowers")
    .select(
      `
      *,
      category:categories(*)
    `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw error;
  }

  return borrower;
}

export const getBorrowerById = unstable_cache(
  fetchBorrowerById,
  ["borrower-by-id"],
  { revalidate: 60, tags: ["borrowers"] },
);

async function fetchBorrowerAccountsWithSchedules(borrowerId: string) {
  const supabase = createSupabaseAdmin();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("borrower_id", borrowerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const accountList = (accounts ?? []) as AccountRow[];
  const initialMetrics: Record<string, AccountComputedMetrics> = {};

  if (accountList.length > 0) {
    const { data: schedulesData } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status",
      )
      .in(
        "account_id",
        accountList.map((a) => a.id),
      )
      .order("due_date", { ascending: true });

    const scheduleRows = schedulesData ?? [];
    const byAccount = new Map<string, typeof scheduleRows>();
    scheduleRows.forEach((row) => {
      const prev = byAccount.get(row.account_id) ?? [];
      prev.push(row);
      byAccount.set(row.account_id, prev);
    });

    accountList.forEach((account) => {
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

      initialMetrics[account.id] = {
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
  }

  return { accountList, initialMetrics };
}

export const getBorrowerAccountsWithSchedules = unstable_cache(
  fetchBorrowerAccountsWithSchedules,
  ["borrower-accounts"],
  { revalidate: 60, tags: ["borrower-accounts"] },
);

async function fetchDeletedBorrowers() {
  const supabase = createSupabaseAdmin();

  const { data: borrowers } = await supabase
    .from("borrowers")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return (borrowers ?? []) as Borrower[];
}

export const getDeletedBorrowers = unstable_cache(
  fetchDeletedBorrowers,
  ["deleted-borrowers"],
  { revalidate: 60, tags: ["deleted-borrowers"] },
);

async function fetchAllDeletedAccounts() {
  const supabase = createSupabaseAdmin();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*, borrower:borrowers(id, first_name, last_name)")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return (accounts ?? []) as Array<
    AccountRow & {
      borrower: { id: string; first_name: string; last_name: string } | null;
    }
  >;
}

export const getAllDeletedAccounts = unstable_cache(
  fetchAllDeletedAccounts,
  ["deleted-accounts"],
  { revalidate: 60, tags: ["deleted-accounts"] },
);

async function fetchDeletedAccountsForBorrower(borrowerId: string) {
  const supabase = createSupabaseAdmin();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("borrower_id", borrowerId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return (accounts ?? []) as AccountRow[];
}

export const getDeletedAccountsForBorrower = unstable_cache(
  fetchDeletedAccountsForBorrower,
  ["deleted-accounts-for-borrower"],
  { revalidate: 60, tags: ["deleted-accounts"] },
);
