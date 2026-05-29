import { createClient } from "@supabase/supabase-js";
import { cacheTag } from "next/cache";
import {
  isInstallmentFullyPaid,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import { computeBorrowerNextCollectionById } from "@/lib/compute-borrower-next-collection";

function createSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
}

export type CategoryDetailData = {
  category: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  borrowers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    contact: string | null;
    created_at: string;
  }>;
  borrowersWithAccountsCount: number;
  moneyToCollect: number;
  nextCollectionDate: string | null;
  nextCollectionTotal: number;
  overdueCount: number;
  overdueTotal: number;
  borrowerAccountCountById: Record<string, number>;
  borrowerNextCollectionById: Record<string, ReturnType<typeof computeBorrowerNextCollectionById>[string]>;
};

export async function getCategoryDetailPageData(
  categoryId: string
): Promise<CategoryDetailData> {
  "use cache";
  cacheTag("categories");
  cacheTag(`category-detail-${categoryId}`);

  const supabase = createSupabaseAdmin();

  const { data: categoryRow } = await supabase
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .single();

  const category = categoryRow
    ? {
        id: String(categoryRow.id),
        name: String(categoryRow.name),
        color: (categoryRow.color as string | null) ?? null,
      }
    : null;

  const { data: assigned } = await supabase
    .from("borrower_categories")
    .select(`
      borrower:borrowers (
        id,
        first_name,
        last_name,
        contact,
        created_at
      )
    `)
    .eq("category_id", categoryId);

  const borrowers = (assigned ?? [])
    .map((row: any) => row.borrower)
    .filter(Boolean)
    .map((b: any) => ({
      id: String(b.id),
      first_name: String(b.first_name),
      last_name: String(b.last_name),
      contact: (b.contact as string | null) ?? null,
      created_at: String(b.created_at),
      borrower_categories: b.borrower_categories ?? [],
    })) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      contact: string | null;
      created_at: string;
      borrower_categories: any[];
    }>;
  const borrowerIds = borrowers.map((b) => b.id);

  let accountRows: Array<{
    id: string;
    borrower_id: string;
    principal_amount: number | null;
    schedule_mode?: string | null;
  }> = [];
  let scheduleRows: Array<{
    account_id: string;
    due_date: string;
    amount_due: number | null;
    amount_paid: number | null;
    remaining_amount: number | null;
    status: string;
  }> = [];

  if (borrowerIds.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, borrower_id, principal_amount, schedule_mode")
      .in("borrower_id", borrowerIds);
    accountRows = (accountsData ?? []) as Array<{
      id: string;
      borrower_id: string;
      principal_amount: number | null;
      schedule_mode?: string | null;
    }>;

    const accountIds = accountRows.map((account) => account.id);
    if (accountIds.length > 0) {
      const { data: schedulesData } = await supabase
        .from("payment_schedules")
        .select(
          "account_id, due_date, amount_due, amount_paid, remaining_amount, status"
        )
        .in("account_id", accountIds)
        .order("due_date", { ascending: true });
      scheduleRows = (schedulesData ?? []) as Array<{
        account_id: string;
        due_date: string;
        amount_due: number | null;
        amount_paid: number | null;
        remaining_amount: number | null;
        status: string;
      }>;
    }
  }

  const borrowerAccountCountById = accountRows.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.borrower_id] = (acc[row.borrower_id] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const borrowersWithAccountsCount = Object.values(
    borrowerAccountCountById
  ).filter((count) => count > 0).length;

  const unpaidSchedules = scheduleRows
    .filter((schedule) => !isInstallmentFullyPaid(schedule))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const principalByAccountId = new Map(
    accountRows.map((a) => [a.id, Number(a.principal_amount ?? 0)])
  );
  const scheduleModeByAccountId = new Map(
    accountRows.map((a) => [a.id, (a as any).schedule_mode as string | null])
  );
  const totalScheduleCountByAccount = new Map<string, number>();
  const unpaidScheduleCountByAccount = new Map<string, number>();
  const paidByAccount = new Map<string, number>();
  for (const s of scheduleRows) {
    totalScheduleCountByAccount.set(
      s.account_id,
      (totalScheduleCountByAccount.get(s.account_id) ?? 0) + 1
    );
    paidByAccount.set(
      s.account_id,
      (paidByAccount.get(s.account_id) ?? 0) + Number(s.amount_paid ?? 0)
    );
  }
  for (const s of unpaidSchedules) {
    unpaidScheduleCountByAccount.set(
      s.account_id,
      (unpaidScheduleCountByAccount.get(s.account_id) ?? 0) + 1
    );
  }

  const manualMoneyToCollect = accountRows.reduce((sum, a) => {
    if ((a as any).schedule_mode !== "manual") return sum;
    const principal = Number(a.principal_amount ?? 0);
    const paid = paidByAccount.get(a.id) ?? 0;
    return sum + Math.max(0, principal - paid);
  }, 0);

  const autoUnpaidAccountIds = [
    ...new Set(unpaidSchedules.map((s) => s.account_id)),
  ].filter((id) => scheduleModeByAccountId.get(id) !== "manual");

  const autoMoneyToCollect = autoUnpaidAccountIds.reduce((sum, accountId) => {
    const principal = principalByAccountId.get(accountId) ?? 0;
    const total = totalScheduleCountByAccount.get(accountId) ?? 1;
    const unpaid = unpaidScheduleCountByAccount.get(accountId) ?? 0;
    return sum + principal * (unpaid / total);
  }, 0);

  const moneyToCollect = manualMoneyToCollect + autoMoneyToCollect;

  const nextCollectionCandidates = unpaidSchedules.sort((a, b) =>
    a.due_date.localeCompare(b.due_date)
  );
  const nextCollectionDate = nextCollectionCandidates[0]?.due_date ?? null;
  const nextCollectionTotal = nextCollectionDate
    ? nextCollectionCandidates
        .filter((schedule) => schedule.due_date === nextCollectionDate)
        .reduce((sum, schedule) => sum + remainingOnInstallment(schedule), 0)
    : 0;

  const overdueSchedules = scheduleRows.filter(
    (s) => s.status === "overdue" && !isInstallmentFullyPaid(s)
  );
  const overdueCount = overdueSchedules.length;
  const overdueTotal = overdueSchedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0
  );

  const borrowerNextCollectionById = computeBorrowerNextCollectionById(
    borrowerIds,
    accountRows,
    scheduleRows
  );

  return {
    category,
    borrowers,
    borrowersWithAccountsCount,
    moneyToCollect,
    nextCollectionDate,
    nextCollectionTotal,
    overdueCount,
    overdueTotal,
    borrowerAccountCountById,
    borrowerNextCollectionById,
  };
}
