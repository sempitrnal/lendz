import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Coins,
  HandCoins,
  Landmark,
  Plus,
  Wallet,
  UserRoundPlus,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";

type DueSchedule = {
  id: string;
  account_id: string;
  amount_due: number | null;
  due_date: string;
  status: string;
};

type AccountRef = {
  id: string;
  borrower_id: string;
  payment_frequency: string | null;
};

type BorrowerRef = {
  id: string;
  first_name: string;
  last_name: string;
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
    { count: overdueCount },
    { data: dueSchedulesData },
    { data: accountTotalsData },
    { data: paidSchedulesData },
    { data: unpaidSchedulesData },
    { data: upcomingSchedulesData },
    { data: unpaidThisMonthData },
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
    supabase
      .from("payment_schedules")
      .select("*", { count: "exact", head: true })
      .eq("status", "overdue"),
    supabase
      .from("payment_schedules")
      .select("id, account_id, amount_due, due_date, status")
      .eq("due_date", todayIso)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase.from("accounts").select("id, principal_amount"),
    supabase
      .from("payment_schedules")
      .select("account_id, amount_due")
      .eq("status", "paid"),
    supabase
      .from("payment_schedules")
      .select("amount_due")
      .neq("status", "paid"),
    supabase
      .from("payment_schedules")
      .select("account_id, due_date, amount_due, status")
      .neq("status", "paid")
      .gte("due_date", todayIso)
      .order("due_date", { ascending: true }),
    supabase
      .from("payment_schedules")
      .select("amount_due")
      .neq("status", "paid")
      .gte("due_date", startOfMonthDate)
      .lte("due_date", endOfMonthDate),
  ]);

  const dueSchedules = (dueSchedulesData ?? []) as DueSchedule[];
  const newBorrowerAccountsWeek = (newBorrowerAccountsWeekData ?? []) as Array<{
    borrower_id: string | null;
  }>;
  const accountTotals = (accountTotalsData ?? []) as Array<{
    id: string;
    principal_amount: number | null;
  }>;
  const paidSchedules = (paidSchedulesData ?? []) as Array<{
    account_id: string;
    amount_due: number | null;
  }>;
  const unpaidSchedules = (unpaidSchedulesData ?? []) as Array<{
    amount_due: number | null;
  }>;
  const upcomingSchedules = (upcomingSchedulesData ?? []) as Array<{
    account_id: string;
    due_date: string;
    amount_due: number | null;
    status: string;
  }>;
  const unpaidThisMonth = (unpaidThisMonthData ?? []) as Array<{
    amount_due: number | null;
  }>;

  const dueTotalToday = dueSchedules.reduce(
    (sum, row) => sum + Number(row.amount_due ?? 0),
    0
  );
  const principalTotal = accountTotals.reduce(
    (sum, row) => sum + Number(row.principal_amount ?? 0),
    0
  );
  const moneyCollected = paidSchedules.reduce(
    (sum, row) => sum + Number(row.amount_due ?? 0),
    0
  );
  const moneyToCollect = unpaidSchedules.reduce(
    (sum, row) => sum + Number(row.amount_due ?? 0),
    0
  );
  const moneyToCollectThisMonth = unpaidThisMonth.reduce(
    (sum, row) => sum + Number(row.amount_due ?? 0),
    0
  );
  const totalContractValue = moneyCollected + moneyToCollect;
  const expectedProfit = totalContractValue - principalTotal;
  const newBorrowersWeekCount = new Set(
    newBorrowerAccountsWeek
      .map((row) => row.borrower_id)
      .filter((id): id is string => Boolean(id))
  ).size;
  const netCashPosition = moneyCollected - principalTotal;
  const principalByAccount = new Map(
    accountTotals.map((row) => [row.id, Number(row.principal_amount ?? 0)])
  );
  const paidByAccount = paidSchedules.reduce((acc, row) => {
    const accountId = row.account_id;
    const current = acc.get(accountId) ?? 0;
    acc.set(accountId, current + Number(row.amount_due ?? 0));
    return acc;
  }, new Map<string, number>());
  const realizedProfit = Array.from(principalByAccount.entries()).reduce(
    (sum, [accountId, principal]) => {
      const paid = paidByAccount.get(accountId) ?? 0;
      return sum + Math.max(0, paid - principal);
    },
    0
  );
  const nextCollectionDate = upcomingSchedules[0]?.due_date ?? null;
  const nextCollectionTotal = nextCollectionDate
    ? upcomingSchedules
        .filter((row) => row.due_date === nextCollectionDate)
        .reduce((sum, row) => sum + Number(row.amount_due ?? 0), 0)
    : 0;
  const nextCollectionCount = nextCollectionDate
    ? upcomingSchedules.filter((row) => row.due_date === nextCollectionDate).length
    : 0;
  const formattedToday = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const nextCollectionSchedules = nextCollectionDate
    ? upcomingSchedules.filter((row) => row.due_date === nextCollectionDate)
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
        .select("id, first_name, last_name")
        .in("id", borrowerIds);
      const borrowers = (borrowersData ?? []) as BorrowerRef[];
      borrowersById = new Map(borrowers.map((row) => [row.id, row]));
    }
  }

  const dueTodayRows = dueSchedules.map((schedule) => {
    const account = accountsById.get(schedule.account_id);
    const borrower = account ? borrowersById.get(account.borrower_id) : null;
    return {
      id: schedule.id,
      name: borrower
        ? `${borrower.first_name} ${borrower.last_name}`
        : "Unknown borrower",
      category: account?.payment_frequency ?? "custom",
      amount: Number(schedule.amount_due ?? 0),
      status: schedule.status,
    };
  });
  const nextCollectionRows = nextCollectionSchedules.map((schedule) => {
    const account = accountsById.get(schedule.account_id);
    const borrower = account ? borrowersById.get(account.borrower_id) : null;
    return {
      id: `${schedule.account_id}-${schedule.due_date}`,
      borrowerId: borrower?.id ?? null,
      name: borrower
        ? `${borrower.first_name} ${borrower.last_name}`
        : "Unknown borrower",
      amount: Number(schedule.amount_due ?? 0),
      category: account?.payment_frequency ?? "custom",
    };
  });

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
    // {
    //   label: "money to collect",
    //   value: `PHP ${moneyToCollect.toLocaleString()}`,
    //   delta: `${overdueCount ?? 0} overdue schedule${overdueCount === 1 ? "" : "s"}`,
    //   icon: Wallet,
    //   tone: "bg-violet-100",
    // },
    {
      label: "collect this month",
      value: `PHP ${moneyToCollectThisMonth.toLocaleString()}`,
      delta: `${now.toLocaleString(undefined, { month: "long" })} unpaid dues`,
      icon: Coins,
      tone: "bg-cyan-100",
    },
    {
      label: "dues today",
      value: `PHP ${dueTotalToday.toLocaleString()}`,
      delta: `${dueTodayRows.length} schedule${dueTodayRows.length === 1 ? "" : "s"}`,
      icon: Coins,
      tone: "bg-blue-100",
    },
    {
      label: "realized profit",
      value: `PHP ${realizedProfit.toLocaleString()}`,
      delta: `expected: PHP ${expectedProfit.toLocaleString()}`,
      icon: Landmark,
      tone: "bg-amber-100",
    },
    {
      label: "net cash position",
      value: `PHP ${netCashPosition.toLocaleString()}`,
      delta: `collected: PHP ${moneyCollected.toLocaleString()}`,
      icon: Wallet,
      tone: "bg-violet-100",
    },
    {
      label: "new loans this month",
      value: String(newLoansMonthCount ?? 0),
      delta: `principal out: PHP ${principalTotal.toLocaleString()}`,
      icon: Landmark,
      tone: "bg-rose-100",
    },
  ] as const;

  const recentNotes = [
    `Collected so far: PHP ${moneyCollected.toLocaleString()}.`,
    `Expected contract value: PHP ${totalContractValue.toLocaleString()}.`,
    `Next collection: ${
      nextCollectionDate
        ? `${new Date(nextCollectionDate).toLocaleDateString()} (PHP ${nextCollectionTotal.toLocaleString()})`
        : "No upcoming unpaid schedule"
    }.`,
    `Total to collect on next collection date: ${
      nextCollectionDate
        ? `PHP ${nextCollectionTotal.toLocaleString()}`
        : "No upcoming unpaid schedule"
    }.`,
    `${newBorrowersWeekCount ?? 0} borrower${newBorrowersWeekCount === 1 ? "" : "s"} added in the last 7 days.`,
  ] as const;

  return (
    <main className="mx-auto w-full max-w-5xl  py-2 ">
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
            className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-white via-slate-50 to-slate-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]"
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
            <p className="mt-1 text-xs font-semibold text-slate-600">{card.delta}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1.3fr_1fr]">
        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-cyan-50 via-white to-blue-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
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
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold uppercase text-slate-600">
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

        <div className="space-y-4">
          <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-emerald-50 via-white to-lime-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
            <h2 className="mb-3 text-base font-black lowercase text-slate-900">
              next collection
            </h2>
            {nextCollectionDate ? (
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {new Date(nextCollectionDate).toLocaleDateString()} • PHP{" "}
                {nextCollectionTotal.toLocaleString()}
              </p>
            ) : null}
            <ul className="space-y-2">
              {nextCollectionRows.length === 0 ? (
                <li className="rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No upcoming unpaid schedule.
                </li>
              ) : (
                nextCollectionRows.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={entry.borrowerId ? `/borrowers/${entry.borrowerId}` : "#"}
                      className="block rounded-lg border-2 border-slate-900 bg-slate-50 px-3 py-2 transition hover:-translate-y-0.5 hover:bg-slate-100"
                      aria-disabled={!entry.borrowerId}
                      tabIndex={entry.borrowerId ? 0 : -1}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold lowercase text-slate-900">{entry.name}</p>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-bold uppercase text-slate-600">
                          {entry.category}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        PHP {entry.amount.toLocaleString()}
                      </p>
                    </Link>
                    {!entry.borrowerId ? (
                      <p className="mt-1 px-1 text-xs text-slate-500">
                        Borrower record unavailable.
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </article>

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

          <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-violet-50 via-white to-fuchsia-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
            <h2 className="mb-3 text-base font-black lowercase text-slate-900">
              operation notes
            </h2>
            <ul className="space-y-2">
              {recentNotes.map((note) => (
                <li
                  key={note}
                  className="rounded-lg border-2 border-slate-900 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  {note}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}