import { createClient } from "@supabase/supabase-js";
import { cacheTag } from "next/cache";
import {
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

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

type ScheduleAggRow = {
  id: string;
  account_id: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  due_date: string;
  status: string;
};

type AccountRef = {
  id: string;
  borrower_id: string;
  payment_frequency: string | null;
  principal_amount: number | null;
};

type BorrowerRef = {
  id: string;
  first_name: string;
  last_name: string;
  borrower_categories?: Array<{
    category:
      | {
          id: string;
          name: string;
          color: string | null;
        }
      | Array<{
          id: string;
          name: string;
          color: string | null;
        }>
      | null;
  }>;
};

const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllSchedules(
  supabase: ReturnType<typeof createSupabaseAdmin>,
): Promise<ScheduleAggRow[]> {
  const allRows: ScheduleAggRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, amount_due, amount_paid, remaining_amount, status, due_date",
      )
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    allRows.push(...(data as ScheduleAggRow[]));
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }
  return allRows;
}

export type NextCollectionData = {
  nextCollectionDate: string | null;
  nextCollectionTotal: number;
  nextCollectionSchedules: ScheduleAggRow[];
  accountsById: Map<string, AccountRef>;
  borrowersById: Map<string, BorrowerRef>;
};

export async function getNextCollectionPageData(): Promise<NextCollectionData> {
  "use cache";
  cacheTag("next-collection");

  const supabase = createSupabaseAdmin();
  const now = new Date();
  const TZ = "Asia/Manila";
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });

  const allSchedules = await fetchAllSchedules(supabase);
  const unpaidSchedules = allSchedules.filter((row) => row.status !== "paid");
  const futureUnpaid = unpaidSchedules.filter(
    (row) => row.due_date >= todayIso,
  );

  const byAccount = new Map<string, ScheduleAggRow[]>();
  for (const row of futureUnpaid) {
    const list = byAccount.get(row.account_id) ?? [];
    list.push(row);
    byAccount.set(row.account_id, list);
  }
  for (const list of byAccount.values()) {
    list.sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
    );
  }
  const futureCandidates = [...byAccount.values()]
    .map((list) => nextDueScheduleForCollection(list))
    .filter((row): row is ScheduleAggRow => Boolean(row))
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
    );

  const nextCollectionDate = futureCandidates[0]?.due_date ?? null;
  const nextCollectionSchedules = nextCollectionDate
    ? futureCandidates.filter((row) => row.due_date === nextCollectionDate)
    : [];

  const nextCollectionTotal = nextCollectionSchedules.reduce(
    (sum, row) => sum + remainingOnInstallment(row),
    0,
  );

  const accountIds = [
    ...new Set(nextCollectionSchedules.map((row) => row.account_id)),
  ];
  let accountsById = new Map<string, AccountRef>();
  let borrowersById = new Map<string, BorrowerRef>();

  if (accountIds.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, borrower_id, payment_frequency, principal_amount")
      .in("id", accountIds)
      .is("deleted_at", null);
    const accounts = (accountsData ?? []) as AccountRef[];
    accountsById = new Map(accounts.map((row) => [row.id, row]));

    const borrowerIds = [...new Set(accounts.map((row) => row.borrower_id))];
    if (borrowerIds.length > 0) {
      const { data: borrowersData } = await supabase
        .from("borrowers")
        .select(
          `
          id,
          first_name,
          last_name,
          borrower_categories (
            category:categories (
              id,
              name,
              color
            )
          )
        `,
        )
        .in("id", borrowerIds)
        .is("deleted_at", null);
      const borrowers = (borrowersData ?? []) as BorrowerRef[];
      borrowersById = new Map(borrowers.map((row) => [row.id, row]));
    }
  }

  return {
    nextCollectionDate,
    nextCollectionTotal,
    nextCollectionSchedules,
    accountsById,
    borrowersById,
  };
}
