import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import NextCollectionPanel from "@/components/dashboard/next-collection-panel";

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

async function fetchSchedulesWhere(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilters?: (query: any) => any
): Promise<ScheduleAggRow[]> {
  const allRows: ScheduleAggRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("payment_schedules")
      .select(
        "id, account_id, amount_due, amount_paid, remaining_amount, status, due_date"
      );

    if (applyFilters) query = applyFilters(query);

    const { data, error } = await query.range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    allRows.push(...(data as ScheduleAggRow[]));
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return allRows;
}

export default async function NextCollectionPage() {
  const supabase = await createSupabaseServer();
  const now = new Date();
  const TZ = "Asia/Manila";
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });

  const unpaidSchedules = await fetchSchedulesWhere(supabase, (q) =>
    q.neq("status", "paid")
  );

  const futureUnpaid = unpaidSchedules.filter((row) => row.due_date >= todayIso);

  const nextPerAccount = (rows: ScheduleAggRow[]) => {
    const byAccount = new Map<string, ScheduleAggRow[]>();
    for (const row of rows) {
      const list = byAccount.get(row.account_id) ?? [];
      list.push(row);
      byAccount.set(row.account_id, list);
    }
    for (const list of byAccount.values()) {
      list.sort(
        (a, b) =>
          a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id)
      );
    }
    return [...byAccount.values()]
      .map((list) => nextDueScheduleForCollection(list))
      .filter((row): row is ScheduleAggRow => Boolean(row))
      .sort(
        (a, b) =>
          a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id)
      );
  };

  const futureCandidates = nextPerAccount(futureUnpaid);
  const nextCollectionDate = futureCandidates[0]?.due_date ?? null;

  const nextCollectionSchedules = nextCollectionDate
    ? futureCandidates.filter((row) => row.due_date === nextCollectionDate)
    : [];

  const nextCollectionTotal = nextCollectionSchedules.reduce(
    (sum, row) => sum + remainingOnInstallment(row),
    0
  );

  const accountIds = [...new Set(nextCollectionSchedules.map((row) => row.account_id))];

  let accountsById = new Map<string, AccountRef>();
  let borrowersById = new Map<string, BorrowerRef>();

  if (accountIds.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, borrower_id, payment_frequency, principal_amount")
      .in("id", accountIds);

    const accounts = (accountsData ?? []) as AccountRef[];
    accountsById = new Map(accounts.map((row) => [row.id, row]));

    const borrowerIds = [...new Set(accounts.map((row) => row.borrower_id))];
    if (borrowerIds.length > 0) {
      const { data: borrowersData } = await supabase
        .from("borrowers")
        .select(`
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
        `)
        .in("id", borrowerIds);
      const borrowers = (borrowersData ?? []) as BorrowerRef[];
      borrowersById = new Map(borrowers.map((row) => [row.id, row]));
    }
  }

  const borrowerCategoryMeta = (borrower?: BorrowerRef | null) => {
    const entries =
      borrower?.borrower_categories
        ?.flatMap((row) => {
          const category = row.category;
          if (!category) return [];
          return Array.isArray(category) ? category : [category];
        })
        .filter(Boolean) ?? [];

    const label =
      entries.length > 0
        ? entries.map((entry) => entry.name).filter(Boolean).join(" / ")
        : "uncategorized";
    const color = entries.find((entry) => entry.color)?.color ?? null;
    return { label, color };
  };

  const nextCollectionRows = (() => {
    const grouped = new Map<
      string,
      {
        borrowerId: string | null;
        name: string;
        category: string;
        categoryColor: string | null;
        schedules: Array<{ id: string; amountDue: number | null; amount: number }>;
      }
    >();

    for (const schedule of nextCollectionSchedules) {
      const account = accountsById.get(schedule.account_id);
      const borrower = account ? borrowersById.get(account.borrower_id) : null;
      const borrowerId = borrower?.id ?? null;
      const key = borrowerId ?? `unknown-${schedule.account_id}`;

      const existing = grouped.get(key);
      if (!existing) {
        const categoryMeta = borrowerCategoryMeta(borrower);
        grouped.set(key, {
          borrowerId,
          name: borrower
            ? `${borrower.first_name} ${borrower.last_name}`
            : "Unknown borrower",
          category: categoryMeta.label,
          categoryColor: categoryMeta.color,
          schedules: [],
        });
      }

      grouped.get(key)!.schedules.push({
        id: schedule.id,
        amountDue: schedule.amount_due,
        amount: remainingOnInstallment(schedule),
      });
    }

    return Array.from(grouped.entries()).map(([key, row]) => {
      const amount = row.schedules.reduce((sum, s) => sum + s.amount, 0);
      return {
        id: `${key}-${nextCollectionDate ?? "none"}`,
        borrowerId: row.borrowerId,
        name: row.name,
        amount,
        amounts: row.schedules.map((s) => s.amount),
        category: row.category,
        categoryColor: row.categoryColor,
        schedules: row.schedules,
      };
    });
  })();

  return (
    <main className="mx-auto w-full max-w-5xl px-1 py-2 sm:px-0">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          back to dashboard
        </Link>
      </div>

      <NextCollectionPanel
        nextCollectionDate={nextCollectionDate}
        nextCollectionTotal={nextCollectionTotal}
        entries={nextCollectionRows}
      />
    </main>
  );
}
