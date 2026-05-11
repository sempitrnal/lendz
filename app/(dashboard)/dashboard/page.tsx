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
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const [
    { count: borrowerCount },
    { count: newBorrowersWeekCount },
    { count: newLoansMonthCount },
    { count: overdueCount },
    { data: dueSchedulesData },
    { data: accountTotalsData },
    { data: paidSchedulesData },
    { data: unpaidSchedulesData },
    { data: nextScheduleData },
  ] = await Promise.all([
    supabase.from("borrowers").select("*", { count: "exact", head: true }),
    supabase
      .from("borrowers")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgoIso),
    supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonthIso),
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
      .select("amount_due")
      .eq("status", "paid"),
    supabase
      .from("payment_schedules")
      .select("amount_due")
      .neq("status", "paid"),
    supabase
      .from("payment_schedules")
      .select("due_date, amount_due, status")
      .neq("status", "paid")
      .gte("due_date", todayIso)
      .order("due_date", { ascending: true })
      .limit(1),
  ]);

  const dueSchedules = (dueSchedulesData ?? []) as DueSchedule[];
  const accountTotals = (accountTotalsData ?? []) as Array<{
    id: string;
    principal_amount: number | null;
  }>;
  const paidSchedules = (paidSchedulesData ?? []) as Array<{
    amount_due: number | null;
  }>;
  const unpaidSchedules = (unpaidSchedulesData ?? []) as Array<{
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
  const totalContractValue = moneyCollected + moneyToCollect;
  const expectedProfit = totalContractValue - principalTotal;
  const realizedProfit = moneyCollected - principalTotal;
  const nextCollection = nextScheduleData?.[0] ?? null;
  const formattedToday = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const dueAccountIds = [...new Set(dueSchedules.map((row) => row.account_id))];

  let accountsById = new Map<string, AccountRef>();
  let borrowersById = new Map<string, BorrowerRef>();

  if (dueAccountIds.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, borrower_id, payment_frequency")
      .in("id", dueAccountIds);

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

  const summaryCards = [
    {
      label: "active borrowers",
      value: String(borrowerCount ?? 0),
      delta: `+${newBorrowersWeekCount ?? 0} this week`,
      icon: HandCoins,
      tone: "bg-emerald-100",
    },
    {
      label: "money to collect",
      value: `PHP ${moneyToCollect.toLocaleString()}`,
      delta: `${overdueCount ?? 0} overdue schedule${overdueCount === 1 ? "" : "s"}`,
      icon: Wallet,
      tone: "bg-violet-100",
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
      label: "new loans this month",
      value: String(newLoansMonthCount ?? 0),
      delta: `principal out: PHP ${principalTotal.toLocaleString()}`,
      icon: CalendarClock,
      tone: "bg-rose-100",
    },
  ] as const;

  const recentNotes = [
    `Collected so far: PHP ${moneyCollected.toLocaleString()}.`,
    `Expected contract value: PHP ${totalContractValue.toLocaleString()}.`,
    `Next collection: ${
      nextCollection
        ? `${new Date(nextCollection.due_date).toLocaleDateString()} (PHP ${Number(nextCollection.amount_due ?? 0).toLocaleString()})`
        : "No upcoming unpaid schedule"
    }.`,
    `${newBorrowersWeekCount ?? 0} borrower${newBorrowersWeekCount === 1 ? "" : "s"} added in the last 7 days.`,
  ] as const;

  return (
    <main className="mx-auto w-full max-w-5xl  py-2 sm:px-6 sm:py-8">
      <section className="mb-4 rounded-xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:mb-6 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          {formattedToday}
        </p>
        <h1 className="mt-1 text-2xl font-black lowercase text-slate-900 sm:text-3xl">
          lending dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-700 sm:max-w-xl">
          Quick glance on active collections, upcoming dues, and account movement.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0px_0px_#0f172a]"
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
        <article className="rounded-xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
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
          <article className="rounded-xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
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

          <article className="rounded-xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
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