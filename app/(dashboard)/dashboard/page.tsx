import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Coins,
  HandCoins,
  Landmark,
  Plus,
  TrendingUp,
  UserRoundPlus,
  ClipboardList,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getAllPaymentSchedules } from "@/lib/cache/schedules";
import {
  isInstallmentFullyPaid,
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import MonthlyCollectionsChart from "@/components/dashboard/monthly-collections-chart";
import CollectionRateRing from "@/components/dashboard/collection-rate-ring";
import OverdueByCategoryChart from "@/components/dashboard/overdue-by-category-chart";
import ThemeToggle from "@/components/theme-toggle";
import ResetCacheButton from "@/components/reset-cache-button";

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
type AccountTotalRow = {
  id: string;
  principal_amount: number | null;
  release_date: string | null;
  term_months: number | null;
  payment_frequency: string | null;
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
  const TZ = "Asia/Manila";
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const [yearStr, monthStr] = todayIso.split("-");
  const phtYear = Number(yearStr);
  const phtMonth = Number(monthStr);
  const startOfMonthDate = `${yearStr}-${monthStr}-01`;
  const startOfMonthIso = `${startOfMonthDate}T00:00:00+08:00`;
  const lastDay = new Date(phtYear, phtMonth, 0).getDate();
  const endOfMonthDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  const weekAgoDate = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString("en-CA", { timeZone: TZ });

  // 6-month window for chart
  const sixMonthsAgoDate = (() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const [
    { count: borrowerCount },
    { data: newBorrowerAccountsWeekData },
    { count: newLoansMonthCount },
    { data: accountTotalsData },
    allSchedules,
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
      .from("accounts")
      .select(
        "id, principal_amount, release_date, term_months, payment_frequency",
      ),
    getAllPaymentSchedules(),
  ]);

  const unpaidSchedules = allSchedules.filter((row) => row.status !== "paid");
  const thisMonthSchedules = allSchedules.filter(
    (row) => row.due_date >= startOfMonthDate && row.due_date <= endOfMonthDate,
  );
  const sixMonthSchedules = allSchedules.filter(
    (row) => row.due_date >= sixMonthsAgoDate && row.due_date <= endOfMonthDate,
  );

  const dueSchedules = unpaidSchedules
    .filter((row) => row.due_date === todayIso && !isInstallmentFullyPaid(row))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 8);

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
          a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
      );
    }
    return [...byAccount.values()]
      .map((list) => nextDueScheduleForCollection(list))
      .filter((row): row is ScheduleAggRow => Boolean(row))
      .sort(
        (a, b) =>
          a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
      );
  };

  const pastOverdueCandidates = nextPerAccount(
    unpaidSchedules.filter((row) => row.due_date < todayIso),
  );
  const futureCandidates = nextPerAccount(
    unpaidSchedules.filter((row) => row.due_date >= todayIso),
  );

  /** Earliest due date among future unpaid schedules. */
  const nextCollectionDate = futureCandidates[0]?.due_date ?? null;

  const newBorrowerAccountsWeek = (newBorrowerAccountsWeekData ?? []) as Array<{
    borrower_id: string | null;
  }>;
  const accountTotals = (accountTotalsData ?? []) as AccountTotalRow[];

  const dueTotalToday = dueSchedules.reduce(
    (sum, row) => sum + remainingOnInstallment(row),
    0,
  );
  const principalTotal = accountTotals.reduce(
    (sum, row) => sum + Number(row.principal_amount ?? 0),
    0,
  );
  const newBorrowersWeekCount = new Set(
    newBorrowerAccountsWeek
      .map((row) => row.borrower_id)
      .filter((id): id is string => Boolean(id)),
  ).size;
  const principalByAccountId = new Map(
    accountTotals.map((a) => [a.id, Number(a.principal_amount ?? 0)]),
  );
  const totalInstallmentsByAccount = new Map(
    accountTotals.map((a) => {
      const term = Number(a.term_months ?? 1);
      const freq = a.payment_frequency ?? "monthly";
      let n = term;
      if (freq === "weekly") n = term * 4;
      else if (freq === "bimonthly") n = term * 2;
      return [a.id, Math.max(1, n)];
    }),
  );
  const unpaidThisMonthCountByAccount = new Map<string, number>();
  for (const s of thisMonthSchedules) {
    if (!isInstallmentFullyPaid(s)) {
      unpaidThisMonthCountByAccount.set(
        s.account_id,
        (unpaidThisMonthCountByAccount.get(s.account_id) ?? 0) + 1,
      );
    }
  }
  const unpaidThisMonthAccountIds = [...unpaidThisMonthCountByAccount.keys()];
  const moneyToCollectThisMonth = unpaidThisMonthAccountIds.reduce(
    (sum, accountId) => {
      const principal = principalByAccountId.get(accountId) ?? 0;
      const total = totalInstallmentsByAccount.get(accountId) ?? 1;
      const unpaid = unpaidThisMonthCountByAccount.get(accountId) ?? 0;
      return sum + principal * (unpaid / total);
    },
    0,
  );
  const nextCollectionTotal = nextCollectionDate
    ? futureCandidates
        .filter((row) => row.due_date === nextCollectionDate)
        .reduce((sum, row) => sum + remainingOnInstallment(row), 0)
    : 0;
  const nextCollectionCount = nextCollectionDate
    ? futureCandidates.filter((row) => row.due_date === nextCollectionDate)
        .length
    : 0;
  const formattedToday = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
  const nextCollectionSchedules = nextCollectionDate
    ? futureCandidates.filter((row) => row.due_date === nextCollectionDate)
    : [];

  // Build 6-month chart data: expected = sum of amount_due, collected = sum of amount_paid
  // profit = amount_paid − principal_per_installment (interest collected)
  const monthlyChartData = (() => {
    const months: {
      label: string;
      fullLabel: string;
      expected: number;
      expectedSoFar: number;
      collected: number;
      profit: number;
      expectedProfit: number;
      expectedProfitSoFar: number;
      isComplete: boolean;
    }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const monthKey = `${y}-${String(m).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const fullLabel = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      let expected = 0;
      let expectedSoFar = 0;
      let collected = 0;
      let profit = 0;
      let expectedProfit = 0;
      let expectedProfitSoFar = 0;
      for (const row of sixMonthSchedules) {
        if (!row.due_date.startsWith(monthKey)) continue;
        const paid = Number(row.amount_paid ?? 0);
        const due = Number(row.amount_due ?? 0);
        expected += due;
        if (row.due_date <= todayIso) expectedSoFar += due;
        collected += paid;
        const principal = principalByAccountId.get(row.account_id) ?? 0;
        const totalInstallments =
          totalInstallmentsByAccount.get(row.account_id) ?? 1;
        const principalPerInstallment = principal / totalInstallments;
        profit += Math.max(0, paid - principalPerInstallment);
        expectedProfit += Math.max(0, due - principalPerInstallment);
        if (row.due_date <= todayIso)
          expectedProfitSoFar += Math.max(0, due - principalPerInstallment);
      }
      months.push({
        label,
        fullLabel,
        expected: Math.round(expected),
        expectedSoFar: Math.round(expectedSoFar),
        collected: Math.round(collected),
        profit: Math.round(profit),
        expectedProfit: Math.round(expectedProfit),
        expectedProfitSoFar: Math.round(expectedProfitSoFar),
        isComplete: i > 0,
      });
    }
    return months;
  })();
  const dueAccountIds = [...new Set(dueSchedules.map((row) => row.account_id))];
  const nextCollectionAccountIds = [
    ...new Set(nextCollectionSchedules.map((row) => row.account_id)),
  ];
  const overdueAccountIds = [
    ...new Set(pastOverdueCandidates.map((row) => row.account_id)),
  ];
  const accountIdsForBorrowerLookup = [
    ...new Set([
      ...dueAccountIds,
      ...nextCollectionAccountIds,
      ...overdueAccountIds,
    ]),
  ];

  let accountsById = new Map<string, AccountRef>();
  let borrowersById = new Map<string, BorrowerRef>();

  if (accountIdsForBorrowerLookup.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, borrower_id, payment_frequency, principal_amount")
      .in("id", accountIdsForBorrowerLookup);

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
              name
              ,
              color
            )
          )
        `,
        )
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
        ? entries
            .map((entry) => entry.name)
            .filter(Boolean)
            .join(" / ")
        : "uncategorized";
    const color = entries.find((entry) => entry.color)?.color ?? null;
    const id = entries.find((entry) => entry.id)?.id ?? null;
    return { label, color, id };
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
        categoryId: string | null;
        schedules: Array<{
          id: string;
          amountDue: number | null;
          amount: number;
        }>;
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
          categoryId: categoryMeta.id,
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
        categoryId: row.categoryId,
        schedules: row.schedules,
      };
    });
  })();

  const overdueRows = (() => {
    const grouped = new Map<
      string,
      {
        borrowerId: string | null;
        name: string;
        category: string;
        categoryColor: string | null;
        seenAccountIds: Set<string>;
        totalPrincipal: number;
      }
    >();

    for (const schedule of pastOverdueCandidates) {
      const account = accountsById.get(schedule.account_id);
      const borrower = account ? borrowersById.get(account.borrower_id) : null;
      const borrowerId = borrower?.id ?? null;
      const key = borrowerId ?? `unknown-${schedule.account_id}`;

      if (!grouped.has(key)) {
        const categoryMeta = borrowerCategoryMeta(borrower);
        grouped.set(key, {
          borrowerId,
          name: borrower
            ? `${borrower.first_name} ${borrower.last_name}`
            : "Unknown borrower",
          category: categoryMeta.label,
          categoryColor: categoryMeta.color,
          seenAccountIds: new Set(),
          totalPrincipal: 0,
        });
      }

      const entry = grouped.get(key)!;
      if (account && !entry.seenAccountIds.has(account.id)) {
        entry.seenAccountIds.add(account.id);
        entry.totalPrincipal += Number(account.principal_amount ?? 0);
      }
    }

    return Array.from(grouped.values()).map(
      ({ seenAccountIds, ...rest }) => rest,
    );
  })();

  const overdueByCategory = (() => {
    const map = new Map<
      string,
      { color: string | null; total: number; principal: number; profit: number }
    >();
    for (const schedule of pastOverdueCandidates) {
      const account = accountsById.get(schedule.account_id);
      const borrower = account ? borrowersById.get(account.borrower_id) : null;
      const meta = borrowerCategoryMeta(borrower ?? null);
      const remaining = remainingOnInstallment(schedule);
      const accPrincipal = principalByAccountId.get(schedule.account_id) ?? 0;
      const totalInstallments =
        totalInstallmentsByAccount.get(schedule.account_id) ?? 1;
      const principalPerInstallment = accPrincipal / totalInstallments;
      const principalPortion = Math.min(remaining, principalPerInstallment);
      const profitPortion = Math.max(0, remaining - principalPerInstallment);
      const existing = map.get(meta.label);
      if (existing) {
        existing.total += remaining;
        existing.principal += principalPortion;
        existing.profit += profitPortion;
      } else {
        map.set(meta.label, {
          color: meta.color,
          total: remaining,
          principal: principalPortion,
          profit: profitPortion,
        });
      }
    }
    return Array.from(map.entries())
      .map(([name, g]) => ({
        name,
        color: g.color,
        total: Math.round(g.total),
        principal: Math.round(g.principal),
        profit: Math.round(g.profit),
      }))
      .sort((a, b) => b.total - a.total);
  })();

  const completeMonths = monthlyChartData.filter((m) => m.isComplete);
  const totalProfitComplete = completeMonths.reduce((s, m) => s + m.profit, 0);
  const avgMonthlyProfit =
    completeMonths.length > 0
      ? Math.round(totalProfitComplete / completeMonths.length)
      : 0;

  const summaryCards = [
    {
      label: "active borrowers",
      value: String(borrowerCount ?? 0),
      delta: `+${newBorrowersWeekCount ?? 0} this week`,
      icon: HandCoins,
      tone: "bg-emerald-100 dark:bg-emerald-900/50",
      bg: "from-emerald-50 via-stone-50 to-emerald-100",
    },
    {
      label: "next collection",
      value: nextCollectionDate
        ? new Date(nextCollectionDate).toLocaleDateString("en-CA")
        : "none",
      delta: nextCollectionDate
        ? `PHP ${nextCollectionTotal.toLocaleString()} • ${nextCollectionCount} schedule${nextCollectionCount === 1 ? "" : "s"}`
        : "no upcoming unpaid schedule",
      icon: CalendarClock,
      tone: "bg-lime-100 dark:bg-lime-900/50",
      bg: "from-lime-50 via-stone-50 to-yellow-100",
    },
    {
      label: "dues today",
      value: `PHP ${dueTotalToday.toLocaleString()}`,
      delta: `${dueTodayRows.length} schedule${dueTodayRows.length === 1 ? "" : "s"}`,
      icon: Coins,
      tone: "bg-orange-100 dark:bg-orange-900/50",
      bg: "from-rose-50 via-stone-50 to-orange-100",
    },
    {
      label: "avg monthly profit",
      value: `PHP ${avgMonthlyProfit.toLocaleString()}`,
      delta: `${monthlyChartData.length}-month average`,
      icon: TrendingUp,
      tone: "bg-amber-100 dark:bg-amber-900/50",
      bg: "from-amber-50 via-stone-50 to-amber-100",
    },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-5xl px-1 py-2 sm:px-0">
      <section className="dark:border-border dark:via-card mb-4 rounded-xl border-2 border-slate-900 bg-linear-to-r from-amber-50 via-stone-50 to-orange-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:mb-6 sm:p-6 dark:from-amber-950/50 dark:to-orange-950/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="dark:text-muted-foreground text-xs font-semibold tracking-wider text-slate-600 uppercase">
              {formattedToday}
            </p>
            <h1 className="dark:text-foreground mt-1 text-2xl font-black text-slate-900 lowercase sm:text-3xl">
              utangz dashboard
            </h1>
          </div>
          <ThemeToggle />
        </div>
        <p className="dark:text-muted-foreground mt-2 text-sm text-slate-700 sm:max-w-xl">
          Quick glance on active collections, upcoming dues, and account
          movement.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className={`dark:border-border dark:from-card dark:via-card dark:to-muted min-w-0 rounded-xl border-2 border-slate-900 bg-linear-to-br ${card.bg} p-4 shadow-[4px_4px_0px_0px_#0f172a]`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="dark:text-muted-foreground text-xs font-bold tracking-wide text-slate-600 uppercase">
                {card.label}
              </span>
              <span
                className={`dark:border-border dark:text-foreground rounded-md border border-slate-900 p-1.5 text-slate-900 ${card.tone}`}
              >
                <card.icon className="size-4" />
              </span>
            </div>
            <p className="dark:text-foreground text-2xl font-black text-slate-900">
              {card.value}
            </p>
            <p className="dark:text-muted-foreground mt-1 text-xs font-semibold wrap-break-word text-slate-600">
              {card.delta}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-4 lg:mt-6">
        <article className="dark:border-border dark:bg-card bg-background min-w-0 rounded-xl border-2 border-slate-900 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="dark:border-border dark:text-foreground rounded-md border border-slate-900 bg-emerald-100 p-1.5 text-slate-900 dark:bg-emerald-900/50">
                <TrendingUp className="size-4" />
              </span>
              <h2 className="dark:text-foreground text-base font-black text-slate-900 lowercase">
                monthly collections
              </h2>
            </div>
          </div>
          <MonthlyCollectionsChart data={monthlyChartData} />

          {/* Profit per month list */}
          <div className="dark:border-border mt-4 border-t-2 border-slate-200 pt-3">
            <p className="dark:text-muted-foreground mb-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
              profit per month
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {monthlyChartData.map((m) => (
                <div
                  key={m.label}
                  className="dark:border-border rounded-lg border-2 border-slate-900 bg-amber-50 px-2.5 py-2 shadow-[2px_2px_0px_0px_#0f172a] dark:bg-amber-900/30"
                >
                  <p className="dark:text-muted-foreground text-[10px] font-black tracking-wide text-slate-500 uppercase">
                    {m.fullLabel}
                  </p>
                  <p className="dark:text-foreground mt-0.5 text-sm font-black text-slate-900 tabular-nums">
                    ₱{m.profit.toLocaleString()}
                  </p>
                  <p className="dark:text-muted-foreground text-[10px] font-semibold text-slate-500">
                    expected ₱{m.expectedProfit.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1fr_1.6fr]">
        <article className="dark:border-border dark:bg-card bg-background min-w-0 rounded-xl border-2 border-slate-900 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
          <CollectionRateRing
            data={{
              collected: monthlyChartData[5]?.collected ?? 0,
              expectedSoFar: monthlyChartData[5]?.expectedSoFar ?? 0,
              profit: monthlyChartData[5]?.profit ?? 0,
              expectedProfit: monthlyChartData[5]?.expectedProfit ?? 0,
              expectedProfitSoFar:
                monthlyChartData[5]?.expectedProfitSoFar ?? 0,
              isComplete: monthlyChartData[5]?.isComplete ?? false,
              monthLabel: monthlyChartData[5]?.label ?? "",
            }}
          />
        </article>
        <article className="dark:border-border dark:bg-card bg-background min-w-0 rounded-xl border-2 border-slate-900 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
          <OverdueByCategoryChart data={overdueByCategory} />
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1.3fr_1fr]">
        <article className="dark:border-border dark:via-card min-w-0 rounded-xl border-2 border-slate-900 bg-linear-to-br from-cyan-50 via-stone-100 to-blue-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5 dark:from-cyan-950/30 dark:to-blue-950/30">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="dark:text-foreground text-base font-black text-slate-900 lowercase">
              due today
            </h2>
            <Link
              href="/borrowers"
              className="dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80 inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900 transition hover:bg-slate-200"
            >
              view all
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <ul className="space-y-2">
            {dueTodayRows.length === 0 ? (
              <li className="dark:border-muted-foreground/40 dark:bg-muted dark:text-muted-foreground rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 p-3 text-sm text-slate-600">
                No schedules due today.
              </li>
            ) : (
              dueTodayRows.map((entry) => (
                <li
                  key={entry.id}
                  className="dark:border-border dark:bg-muted rounded-lg border-2 border-slate-900 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="dark:text-foreground font-bold text-slate-900 lowercase">
                      {entry.name}
                    </p>
                    <span className="dark:bg-card dark:text-muted-foreground inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600 uppercase">
                      <span
                        className="dark:border-border size-2 shrink-0 rounded-full border border-slate-900/25"
                        style={{
                          backgroundColor: entry.categoryColor ?? "#cbd5e1",
                        }}
                        aria-hidden
                      />
                      {entry.category}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <p className="dark:text-foreground font-semibold text-slate-700">
                      PHP {entry.amount.toLocaleString()}
                    </p>
                    <p className="dark:text-muted-foreground text-xs font-semibold text-slate-600 uppercase">
                      {entry.status}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <div className="min-w-0 space-y-4">
          <article className="dark:border-border dark:via-card min-w-0 rounded-xl border-2 border-slate-900 bg-linear-to-br from-emerald-50 via-stone-100 to-lime-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5 dark:from-emerald-950/30 dark:to-lime-950/30">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="dark:text-foreground text-base font-black text-slate-900 lowercase">
                next collection
              </h2>
              {nextCollectionSchedules.length > 0 ? (
                <Link
                  href="/next-collection"
                  className="dark:border-border dark:text-foreground inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-emerald-200 px-2.5 py-1 text-xs font-bold text-slate-900 transition hover:bg-emerald-300 dark:bg-emerald-800/50 dark:hover:bg-emerald-800"
                >
                  view all
                  <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null}
            </div>
            {nextCollectionDate ? (
              <p className="dark:text-muted-foreground mb-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                {new Date(nextCollectionDate).toLocaleDateString()} • PHP{" "}
                {nextCollectionTotal.toLocaleString()}
              </p>
            ) : null}
            {nextCollectionRows.length === 0 ? (
              <div className="dark:border-muted-foreground/40 dark:bg-muted dark:text-muted-foreground rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No upcoming unpaid schedule.
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const groups = new Map<
                    string,
                    {
                      color: string | null;
                      categoryId: string | null;
                      accountCount: number;
                      total: number;
                    }
                  >();
                  for (const entry of nextCollectionRows) {
                    const existing = groups.get(entry.category);
                    if (existing) {
                      existing.accountCount += entry.schedules.length;
                      existing.total += entry.amount;
                    } else {
                      groups.set(entry.category, {
                        color: entry.categoryColor ?? null,
                        categoryId: entry.categoryId ?? null,
                        accountCount: entry.schedules.length,
                        total: entry.amount,
                      });
                    }
                  }
                  return Array.from(groups.entries()).map(([category, g]) => {
                    const inner = (
                      <div className="dark:border-border dark:bg-muted flex items-center justify-between gap-2 rounded-lg border-2 border-slate-900 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="dark:border-border size-2.5 shrink-0 rounded-full border border-slate-900/25"
                            style={{ backgroundColor: g.color ?? "#cbd5e1" }}
                            aria-hidden
                          />
                          <span className="dark:text-foreground text-xs font-black tracking-wide text-slate-700 uppercase">
                            {category}
                          </span>
                          <span className="dark:border-border dark:bg-card dark:text-muted-foreground rounded-md border border-slate-900/20 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 tabular-nums">
                            {g.accountCount}
                          </span>
                        </div>
                        <span className="dark:text-muted-foreground text-xs font-semibold text-slate-600">
                          PHP {g.total.toLocaleString()}
                        </span>
                      </div>
                    );
                    if (g.categoryId) {
                      return (
                        <Link
                          key={category}
                          href={`/categories/${g.categoryId}`}
                          className="block transition hover:opacity-80"
                        >
                          {inner}
                        </Link>
                      );
                    }
                    return <div key={category}>{inner}</div>;
                  });
                })()}
                <div className="dark:border-border dark:bg-foreground flex items-center justify-between rounded-lg border-2 border-slate-900 bg-slate-900 px-3 py-2">
                  <span className="dark:text-background text-xs font-black tracking-wide text-white uppercase">
                    Total
                  </span>
                  <span className="dark:text-background text-xs font-black text-white tabular-nums">
                    {nextCollectionCount} account
                    {nextCollectionCount === 1 ? "" : "s"} • PHP{" "}
                    {nextCollectionTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </article>

          <article className="dark:border-border dark:via-card rounded-xl border-2 border-slate-900 bg-linear-to-br from-amber-50 via-stone-100 to-orange-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5 dark:from-amber-950/30 dark:to-orange-950/30">
            <h2 className="dark:text-foreground mb-3 text-base font-black text-slate-900 lowercase">
              quick actions
            </h2>
            <div className="space-y-2">
              <Link
                href="/borrowers"
                className="dark:border-border dark:text-foreground flex items-center justify-between rounded-lg border-2 border-slate-900 bg-emerald-100 px-3 py-2 text-sm font-bold text-slate-900 lowercase transition hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60"
              >
                add borrower
                <UserRoundPlus className="size-4" />
              </Link>
              <Link
                href="/categories"
                className="dark:border-border dark:text-foreground flex items-center justify-between rounded-lg border-2 border-slate-900 bg-sky-100 px-3 py-2 text-sm font-bold text-slate-900 lowercase transition hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/60"
              >
                manage categories
                <Plus className="size-4" />
              </Link>
              <Link
                href="/audit"
                className="dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80 flex items-center justify-between rounded-lg border-2 border-slate-900 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-900 lowercase transition hover:bg-slate-200"
              >
                audit trail
                <ClipboardList className="size-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* {overdueRows.length > 0 ? (
        <section className="mt-4 lg:mt-6">
          <article className="min-w-0 rounded-xl border-2 border-slate-900 bg-linear-to-br from-rose-50 via-white to-orange-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
            <h2 className="mb-3 text-base font-black lowercase text-slate-900">
              past due
            </h2>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {overdueRows.length} borrower{overdueRows.length === 1 ? "" : "s"} with overdue schedules
            </p>
            <ul className="space-y-2">
              {overdueRows.map((entry) => (
                <li
                  key={entry.borrowerId ?? entry.name}
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
                  <div className="mt-1 text-sm">
                    <p className="font-semibold text-slate-700">
                      Loaned: PHP {entry.totalPrincipal.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null} */}

      <section className="mt-4 flex justify-end lg:mt-6">
        <ResetCacheButton />
      </section>
    </main>
  );
}
