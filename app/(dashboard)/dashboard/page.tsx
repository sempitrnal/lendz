import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Coins,
  HandCoins,
  Landmark,
  Plus,
  UserRoundPlus,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import NextCollectionPanel from "@/components/dashboard/next-collection-panel";
import DailyNotesWidget from "@/components/dashboard/daily-notes-widget";

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
};
type AccountTotalRow = {
  id: string;
  principal_amount: number | null;
  release_date: string | null;
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

export default async function Dashboard() {
  const supabase = await createSupabaseServer();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startOfMonthIso = startOfMonth.toISOString();
  const startOfMonthDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const endOfMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoDate = weekAgo.toISOString().slice(0, 10);

  const [
    { count: borrowerCount },
    { data: newBorrowerAccountsWeekData },
    { count: newLoansMonthCount },
    { data: accountTotalsData },
    { data: allSchedulesData },
  ] = await Promise.all([
    supabase.from("borrowers").select("*", { count: "exact", head: true }),
    supabase
      .from("accounts")
      .select("borrower_id")
      .gte("release_date", weekAgoDate)
      .lte("release_date", todayIso),
    supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .gte("release_date", startOfMonthIso),
    supabase.from("accounts").select("id, principal_amount, release_date"),
    supabase
      .from("payment_schedules")
      .select(
        "id, account_id, amount_due, amount_paid, remaining_amount, status, due_date"
      ),
  ]);

  const allSchedules = (allSchedulesData ?? []) as ScheduleAggRow[];

  const dueSchedules = allSchedules
    .filter(
      (row) => row.due_date === todayIso && !isInstallmentFullyPaid(row)
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 8);

  const schedulesByAccount = new Map<string, ScheduleAggRow[]>();
  for (const row of allSchedules) {
    const list = schedulesByAccount.get(row.account_id) ?? [];
    list.push(row);
    schedulesByAccount.set(row.account_id, list);
  }
  for (const list of schedulesByAccount.values()) {
    list.sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id)
    );
  }

  const nextCollectionCandidates = [...schedulesByAccount.values()]
    .map((list) => nextDueScheduleForCollection(list))
    .filter((row): row is ScheduleAggRow => Boolean(row))
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id)
    );

  /** Earliest due date among each account’s next pending unpaid installment (else next unpaid). */
  const nextCollectionDate = nextCollectionCandidates[0]?.due_date ?? null;

  const newBorrowerAccountsWeek = (newBorrowerAccountsWeekData ?? []) as Array<{
    borrower_id: string | null;
  }>;
  const accountTotals = (accountTotalsData ?? []) as AccountTotalRow[];

  const dueTotalToday = dueSchedules.reduce(
    (sum, row) => sum + remainingOnInstallment(row),
    0
  );
  const principalTotal = accountTotals.reduce(
    (sum, row) => sum + Number(row.principal_amount ?? 0),
    0
  );
  const moneyCollected = allSchedules.reduce(
    (sum, row) => sum + amountPaidOnInstallment(row),
    0
  );
  const moneyToCollect = allSchedules.reduce(
    (sum, row) =>
      sum + (isInstallmentFullyPaid(row) ? 0 : remainingOnInstallment(row)),
    0
  );
  const totalContractValue = moneyCollected + moneyToCollect;
  const newBorrowersWeekCount = new Set(
    newBorrowerAccountsWeek
      .map((row) => row.borrower_id)
      .filter((id): id is string => Boolean(id))
  ).size;
  const principalReleasedThisMonth = accountTotals.reduce((sum, row) => {
    if (!row.release_date) return sum;
    if (row.release_date < startOfMonthDate || row.release_date > endOfMonthDate) {
      return sum;
    }
    return sum + Number(row.principal_amount ?? 0);
  }, 0);
  const collectedThisMonth = allSchedules.reduce((sum, row) => {
    if (row.due_date < startOfMonthDate || row.due_date > endOfMonthDate) return sum;
    return sum + amountPaidOnInstallment(row);
  }, 0);
  const profitThisMonth = collectedThisMonth - principalReleasedThisMonth;
  const nextCollectionTotal = nextCollectionDate
    ? nextCollectionCandidates
        .filter((row) => row.due_date === nextCollectionDate)
        .reduce((sum, row) => sum + remainingOnInstallment(row), 0)
    : 0;
  const nextCollectionCount = nextCollectionDate
    ? nextCollectionCandidates.filter((row) => row.due_date === nextCollectionDate).length
    : 0;
  const formattedToday = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const nextCollectionSchedules = nextCollectionDate
    ? nextCollectionCandidates.filter((row) => row.due_date === nextCollectionDate)
    : [];
  const dueAccountIds = [...new Set(dueSchedules.map((row) => row.account_id))];
  const nextCollectionAccountIds = [
    ...new Set(nextCollectionSchedules.map((row) => row.account_id)),
  ];
  const accountIdsForBorrowerLookup = [
    ...new Set([...dueAccountIds, ...nextCollectionAccountIds]),
  ];

  let accountsById = new Map<string, AccountRef>();
  let borrowersById = new Map<string, BorrowerRef>();

  if (accountIdsForBorrowerLookup.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, borrower_id, payment_frequency")
      .in("id", accountIdsForBorrowerLookup);

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
              name
              ,
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

  const dueTodayRows = dueSchedules.map((schedule) => {
    const account = accountsById.get(schedule.account_id);
    const borrower = account ? borrowersById.get(account.borrower_id) : null;
    const categoryMeta = borrowerCategoryMeta(borrower);
    return {
      id: schedule.id,
      name: borrower
        ? `${borrower.first_name} ${borrower.last_name}`
        : "Unknown borrower",
      category: categoryMeta.label,
      categoryColor: categoryMeta.color,
      amount: remainingOnInstallment(schedule),
      status: schedule.status,
    };
  });
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

  const summaryCards = [
    {
      label: "active borrowers",
      value: String(borrowerCount ?? 0),
      delta: `+${newBorrowersWeekCount ?? 0} this week`,
      icon: HandCoins,
      tone: "bg-emerald-100",
    },
    {
      label: "next collection",
      value: nextCollectionDate
        ? new Date(nextCollectionDate).toLocaleDateString()
        : "none",
      delta: nextCollectionDate
        ? `PHP ${nextCollectionTotal.toLocaleString()} • ${nextCollectionCount} schedule${nextCollectionCount === 1 ? "" : "s"}`
        : "no upcoming unpaid schedule",
      icon: CalendarClock,
      tone: "bg-lime-100",
    },
    {
      label: "dues today",
      value: `PHP ${dueTotalToday.toLocaleString()}`,
      delta: `${dueTodayRows.length} schedule${dueTodayRows.length === 1 ? "" : "s"}`,
      icon: Coins,
      tone: "bg-blue-100",
    },
    {
      label: "profit this month",
      value: `PHP ${profitThisMonth.toLocaleString()}`,
      delta: `collected: PHP ${collectedThisMonth.toLocaleString()} • principal out: PHP ${principalReleasedThisMonth.toLocaleString()}`,
      icon: Landmark,
      tone: "bg-amber-100",
    },
    {
      label: "new loans this month",
      value: String(newLoansMonthCount ?? 0),
      delta: `principal out: PHP ${principalTotal.toLocaleString()}`,
      icon: Landmark,
      tone: "bg-rose-100",
    },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-5xl px-1 py-2 sm:px-0">
      <section className="mb-4 rounded-xl border-2 border-slate-900 bg-linear-to-r from-indigo-50 via-white to-sky-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:mb-6 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          {formattedToday}
        </p>
        <h1 className="mt-1 text-2xl font-black lowercase text-slate-900 sm:text-3xl">
          utangz dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-700 sm:max-w-xl">
          Quick glance on active collections, upcoming dues, and account movement.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="min-w-0 rounded-xl border-2 border-slate-900 bg-linear-to-br from-white via-slate-50 to-slate-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                {card.label}
              </span>
              <span
                className={`rounded-md border border-slate-900 p-1.5 text-slate-900 ${card.tone}`}
              >
                <card.icon className="size-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900">{card.value}</p>
            <p className="mt-1 wrap-break-word text-xs font-semibold text-slate-600">
              {card.delta}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1.3fr_1fr]">
        <article className="min-w-0 rounded-xl border-2 border-slate-900 bg-linear-to-br from-cyan-50 via-white to-blue-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black lowercase text-slate-900">due today</h2>
            <Link
              href="/borrowers"
              className="inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900 transition hover:bg-slate-200"
            >
              view all
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <ul className="space-y-2">
            {dueTodayRows.length === 0 ? (
              <li className="rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 p-3 text-sm text-slate-600">
                No schedules due today.
              </li>
            ) : (
              dueTodayRows.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border-2 border-slate-900 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold lowercase text-slate-900">{entry.name}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs font-bold uppercase text-slate-600">
                      <span
                        className="size-2 shrink-0 rounded-full border border-slate-900/25"
                        style={{ backgroundColor: entry.categoryColor ?? "#cbd5e1" }}
                        aria-hidden
                      />
                      {entry.category}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <p className="font-semibold text-slate-700">
                      PHP {entry.amount.toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold uppercase text-slate-600">
                      {entry.status}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <div className="min-w-0 space-y-4">
          <NextCollectionPanel
            nextCollectionDate={nextCollectionDate}
            nextCollectionTotal={nextCollectionTotal}
            entries={nextCollectionRows}
          />

          <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-amber-50 via-white to-orange-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
            <h2 className="mb-3 text-base font-black lowercase text-slate-900">
              quick actions
            </h2>
            <div className="space-y-2">
              <Link
                href="/borrowers"
                className="flex items-center justify-between rounded-lg border-2 border-slate-900 bg-emerald-100 px-3 py-2 text-sm font-bold lowercase text-slate-900 transition hover:bg-emerald-200"
              >
                add borrower
                <UserRoundPlus className="size-4" />
              </Link>
              <Link
                href="/categories"
                className="flex items-center justify-between rounded-lg border-2 border-slate-900 bg-sky-100 px-3 py-2 text-sm font-bold lowercase text-slate-900 transition hover:bg-sky-200"
              >
                manage categories
                <Plus className="size-4" />
              </Link>
            </div>
          </article>

          <DailyNotesWidget />
        </div>
      </section>
    </main>
  );
}