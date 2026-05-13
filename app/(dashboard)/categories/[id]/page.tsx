import BackButton from "@/components/back-button";
import AssignBorrower from "@/components/category/assign-borrower";
import CategoryBorrowersGrid from "@/components/category/category-borrowers-grid";
import { computeBorrowerNextCollectionById } from "@/lib/compute-borrower-next-collection";
import {
  isInstallmentFullyPaid,
  mapAccountIdToNextDueSchedule,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function CategoryDetailView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServer();

  const { id: categoryId } = await params;
  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .single();

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

  const borrowers = assigned?.map((row: any) => row.borrower).filter(Boolean) ?? [];
  const borrowerIds = borrowers.map((b: any) => b.id);

  let accountRows: Array<{ id: string; borrower_id: string; principal_amount: number | null }> = [];
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
      .select("id, borrower_id, principal_amount")
      .in("borrower_id", borrowerIds);
    accountRows = (accountsData ?? []) as Array<{ id: string; borrower_id: string; principal_amount: number | null }>;

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
  const borrowersWithAccountsCount = Object.values(borrowerAccountCountById).filter(
    (count) => count > 0
  ).length;
  const unpaidSchedules = scheduleRows
    .filter((schedule) => !isInstallmentFullyPaid(schedule))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const principalByAccountId = new Map(
    accountRows.map((a) => [a.id, Number(a.principal_amount ?? 0)])
  );
  const paidByAccount = new Map<string, number>();
  for (const s of scheduleRows) {
    const prev = paidByAccount.get(s.account_id) ?? 0;
    const paid = Math.min(
      Math.max(0, Number(s.amount_due ?? 0)),
      s.status === "paid"
        ? Math.max(0, Number(s.amount_due ?? 0))
        : Math.max(0, Number(s.amount_paid ?? 0))
    );
    paidByAccount.set(s.account_id, prev + paid);
  }
  const moneyToCollect = [...new Set(unpaidSchedules.map((s) => s.account_id))].reduce(
    (sum, accountId) => {
      const principal = principalByAccountId.get(accountId) ?? 0;
      const paid = paidByAccount.get(accountId) ?? 0;
      return sum + Math.max(0, principal - paid);
    },
    0
  );

  const nextCollectionCandidates = [
    ...mapAccountIdToNextDueSchedule(scheduleRows).values(),
  ].sort((a, b) => a.due_date.localeCompare(b.due_date));
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

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/categories" />
      <div>
        <h1 className="text-2xl font-bold">{category?.name}</h1>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-cyan-50 via-white to-sky-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            borrowers in category
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{borrowers.length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">Assigned borrowers</p>
        </article>

        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-emerald-50 via-white to-lime-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            borrowers with accounts
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {borrowersWithAccountsCount}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            With at least one account
          </p>
        </article>

        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-amber-50 via-white to-orange-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            money to collect
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            PHP {moneyToCollect.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Unpaid schedules in this category
          </p>
        </article>

        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-violet-50 via-white to-fuchsia-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            next collection
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {nextCollectionDate
              ? new Date(nextCollectionDate).toLocaleDateString()
              : "none"}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            PHP {nextCollectionTotal.toLocaleString()}
          </p>
        </article>

        {overdueCount > 0 ? (
          <article className="rounded-xl border-2 border-red-900 bg-linear-to-br from-red-50 via-white to-rose-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              overdue
            </p>
            <p className="mt-1 text-2xl font-black text-red-700">
              {overdueCount} due date{overdueCount === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              PHP {overdueTotal.toLocaleString()}
            </p>
          </article>
        ) : null}
      </section>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Assigned Borrowers</h2>

        {borrowers.length === 0 ? (
          <p className="text-sm text-gray-500">No borrowers assigned yet</p>
        ) : (
          <CategoryBorrowersGrid
            borrowers={borrowers}
            borrowerAccountCountById={borrowerAccountCountById}
            borrowerNextCollectionById={borrowerNextCollectionById}
          />
        )}
      </div>
      <AssignBorrower
        initialAssigned={borrowers}
        categoryId={categoryId}
        key={categoryId}
      />
    </div>
  );
}