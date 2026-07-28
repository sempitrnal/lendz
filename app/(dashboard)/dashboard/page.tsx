import Link from "next/link";
import {
  Coins,
  HandCoins,
  Plus,
  TrendingUp,
  UserRoundPlus,
  ClipboardList,
  Bell,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { logPageView } from "@/lib/audit";
import { getAllPaymentSchedules } from "@/lib/cache/schedules";
import {
  isInstallmentFullyPaid,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import ThemeToggle from "@/components/theme-toggle";
import ResetCacheButton from "@/components/reset-cache-button";
import MonthPicker from "@/components/month-picker";

type ScheduleAggRow = {
  id: string;
  account_id: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  due_date: string;
  paid_date: string | null;
  status: string;
};

type AccountTotalRow = {
  id: string;
  borrower_id: string;
  principal_amount: number | null;
  release_date: string | null;
  term_months: number | null;
  payment_frequency: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  color: string | null;
};

type BorrowerCategoryRow = {
  borrower_id: string;
  category_id: string;
};

function metricCardClass(fromColor: string, darkFromColor: string) {
  return `dark:border-border rounded-lg dark:border 
    bg-linear-to-br from-emerald-50 via-stone-50 to-slate-50 p-5
    dark:via-zinc-900/40 dark:to-zinc-900/60`;
}

const metricCardLabelClass = `dark:text-muted-foreground text-[10px] font-semibold
  tracking-wide text-slate-500 uppercase`;

const metricCardValueClass = `dark:text-foreground mt-0.5 text-base font-semibold
  text-slate-600 tabular-nums`;

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createSupabaseServer();
  await logPageView("/dashboard");
  const now = new Date();
  const TZ = "Asia/Manila";
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const defaultMonth = todayIso.slice(0, 7);
  const isValid = /^\d{4}-\d{2}$/.test(params.month ?? "");
  const activeMonth = isValid ? params.month! : defaultMonth;

  const [yearStr, monthStr] = activeMonth.split("-");
  const phtYear = Number(yearStr);
  const phtMonth = Number(monthStr);
  const startOfMonthDate = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(phtYear, phtMonth, 0).getDate();
  const endOfMonthDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  const weekAgoDate = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString("en-CA", { timeZone: TZ });

  // 6-month window for chart
  const sixMonthsAgoDate = (() => {
    const d = new Date(`${activeMonth}-01`);
    d.setMonth(d.getMonth() - 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const [
    { count: borrowerCount },
    { data: newBorrowerAccountsWeekData },
    { data: accountTotalsData },
    { data: borrowerCategoriesData },
    { data: categoriesData },
    allSchedules,
  ] = await Promise.all([
    supabase
      .from("borrowers")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("accounts")
      .select("borrower_id")
      .is("deleted_at", null)
      .gte("release_date", weekAgoDate)
      .lte("release_date", todayIso),
    supabase
      .from("accounts")
      .select(
        "id, borrower_id, principal_amount, release_date, term_months, payment_frequency",
      )
      .is("deleted_at", null),
    supabase.from("borrower_categories").select("borrower_id, category_id"),
    supabase.from("categories").select("id, name, color"),
    getAllPaymentSchedules(),
  ]);

  const validAccountIds = new Set(
    (accountTotalsData ?? []).map((a: { id: string }) => a.id),
  );
  const filteredSchedules = allSchedules.filter((row) =>
    validAccountIds.has(row.account_id),
  );

  const unpaidSchedules = filteredSchedules.filter(
    (row) => row.status !== "paid",
  );
  const thisMonthSchedules = filteredSchedules.filter(
    (row) => row.due_date >= startOfMonthDate && row.due_date <= endOfMonthDate,
  );
  const sixMonthSchedules = filteredSchedules.filter(
    (row) => row.due_date >= sixMonthsAgoDate && row.due_date <= endOfMonthDate,
  );

  const dueSchedules = unpaidSchedules
    .filter((row) => row.due_date === todayIso && !isInstallmentFullyPaid(row))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 8);

  const newBorrowerAccountsWeek = (newBorrowerAccountsWeekData ?? []) as Array<{
    borrower_id: string | null;
  }>;
  const accountTotals = (accountTotalsData ?? []) as AccountTotalRow[];

  const dueTotalToday = dueSchedules.reduce(
    (sum, row) => sum + remainingOnInstallment(row),
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
  const formattedToday = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });

  const activeDate = new Date(`${activeMonth}-01`);

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
    const activeYear = activeDate.getFullYear();
    const activeMonthIndex = activeDate.getMonth();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(activeYear, activeMonthIndex - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const monthKey = `${y}-${String(m).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const fullLabel = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      const isPastMonth = monthKey < todayIso.slice(0, 7);
      const isCurrentMonth = monthKey === todayIso.slice(0, 7);

      let expected = 0;
      let expectedSoFar = 0;
      let collected = 0;
      let profit = 0;
      let expectedProfit = 0;
      let expectedProfitSoFar = 0;
      for (const row of sixMonthSchedules) {
        const paid = Number(row.amount_paid ?? 0);
        const due = Number(row.amount_due ?? 0);
        const principal = principalByAccountId.get(row.account_id) ?? 0;
        const totalInstallments =
          totalInstallmentsByAccount.get(row.account_id) ?? 1;
        const principalPerInstallment = principal / totalInstallments;

        if (row.due_date.startsWith(monthKey)) {
          expected += due;
          if (isPastMonth || (isCurrentMonth && row.due_date <= todayIso))
            expectedSoFar += due;
          expectedProfit += Math.max(0, due - principalPerInstallment);
          if (isPastMonth || (isCurrentMonth && row.due_date <= todayIso))
            expectedProfitSoFar += Math.max(0, due - principalPerInstallment);
          collected += paid;
          profit += Math.max(0, paid - principalPerInstallment);
        }
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

  const currentMonthData = monthlyChartData[monthlyChartData.length - 1];
  const currentMonthRemainingProfit = Math.max(
    0,
    (currentMonthData?.expectedProfit ?? 0) - (currentMonthData?.profit ?? 0),
  );

  // Profit per category for the active month
  const categories = (categoriesData ?? []) as CategoryRow[];
  const borrowerCategories = (borrowerCategoriesData ??
    []) as BorrowerCategoryRow[];
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const borrowerCategoriesByBorrower = new Map<string, string[]>();
  for (const row of borrowerCategories) {
    const list = borrowerCategoriesByBorrower.get(row.borrower_id) ?? [];
    list.push(row.category_id);
    borrowerCategoriesByBorrower.set(row.borrower_id, list);
  }
  const accountBorrowerById = new Map(
    (accountTotalsData ?? []).map((a) => [a.id, a.borrower_id]),
  );
  const statsByCategory = new Map<
    string,
    { profit: number; collected: number; remaining: number }
  >();
  for (const row of thisMonthSchedules) {
    const borrowerId = accountBorrowerById.get(row.account_id);
    if (!borrowerId) continue;
    const categoryIds = borrowerCategoriesByBorrower.get(borrowerId) ?? [];
    if (categoryIds.length === 0) continue;
    const principal = principalByAccountId.get(row.account_id) ?? 0;
    const totalInstallments =
      totalInstallmentsByAccount.get(row.account_id) ?? 1;
    const principalPerInstallment = principal / totalInstallments;
    const paid = Number(row.amount_paid ?? 0);
    const due = Number(row.amount_due ?? 0);
    const profit = Math.max(0, paid - principalPerInstallment);
    const remaining = Math.max(0, due - paid);
    for (const categoryId of categoryIds) {
      const current = statsByCategory.get(categoryId) ?? {
        profit: 0,
        collected: 0,
        remaining: 0,
      };
      statsByCategory.set(categoryId, {
        profit: current.profit + profit,
        collected: current.collected + paid,
        remaining: current.remaining + remaining,
      });
    }
  }
  const profitPerCategory = categories
    .filter((c) => categoryById.has(c.id))
    .map((c) => {
      const stats = statsByCategory.get(c.id) ?? {
        profit: 0,
        collected: 0,
        remaining: 0,
      };
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        profit: Math.round(stats.profit),
        collected: Math.round(stats.collected),
        remaining: Math.round(stats.remaining),
      };
    })
    .filter((c) => c.profit > 0 || c.collected > 0 || c.remaining > 0)
    .sort((a, b) => b.profit - a.profit);

  const completeMonths = monthlyChartData.filter((m) => m.isComplete);
  const totalProfitComplete = completeMonths.reduce((s, m) => s + m.profit, 0);
  const avgMonthlyProfit =
    completeMonths.length > 0
      ? Math.round(totalProfitComplete / completeMonths.length)
      : 0;

  const dueSchedulesCount = dueSchedules.length;

  const summaryCards = [
    {
      label: "active borrowers",
      value: String(borrowerCount ?? 0),
      delta: `+${newBorrowersWeekCount ?? 0} this week`,
      icon: HandCoins,
      tone: "bg-emerald-100 dark:bg-emerald-900/50",
      bg: "from-emerald-50 via-stone-50 to-emerald-100",
    },
    // {
    //   label: "next collection",
    //   value: nextCollectionDate
    //     ? new Date(nextCollectionDate).toLocaleDateString("en-CA")
    //     : "none",
    //   delta: nextCollectionDate
    //     ? `PHP ${nextCollectionTotal.toLocaleString()} • ${nextCollectionCount} schedule${nextCollectionCount === 1 ? "" : "s"}`
    //     : "no upcoming unpaid schedule",
    //   icon: CalendarClock,
    //   tone: "bg-lime-100 dark:bg-lime-900/50",
    //   bg: "from-lime-50 via-stone-50 to-yellow-100",
    // },
    {
      label: "dues today",
      value: `PHP ${dueTotalToday.toLocaleString()}`,
      delta: `${dueSchedulesCount} schedule${dueSchedulesCount === 1 ? "" : "s"}`,
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
    <main className="mx-auto max-w-7xl py-10 md:max-w-full px-4 pb-16 md:px-6">
      <section
        className="dark:border-border mb-4 rounded-xl shadow-sm bg-white p-4
          sm:mb-6 sm:p-6 dark:bg-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="dark:text-muted-foreground text-xs font-semibold
                tracking-wider text-slate-600 uppercase"
            >
              {formattedToday}
            </p>
            <h1
              className="dark:text-foreground mt-1 text-2xl font-black
                text-slate-600 lowercase sm:text-3xl"
            >
              utangz dashboard
            </h1>
          </div>
          <ThemeToggle />
        </div>
        <p
          className="dark:text-muted-foreground mt-2 text-sm text-slate-700
            sm:max-w-xl"
        >
          Quick glance on active collections, upcoming dues, and account
          movement.
        </p>
        <section
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3
            mt-4"
        >
          {summaryCards.map((card) => (
            <article
              key={card.label}
              className="dark:bg-card min-w-0 rounded-xl shadow-sm dark:border-2
                border-slate-900 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="dark:text-muted-foreground text-xs font-bold
                    tracking-wide text-slate-600 uppercase"
                >
                  {card.label}
                </span>
                <span
                  className={`dark:border-border dark:text-foreground rounded-md
                  p-1.5 text-slate-600 ${card.tone}`}
                >
                  <card.icon className="size-4" />
                </span>
              </div>
              <p
                className="dark:text-foreground text-2xl font-black
                  text-slate-600"
              >
                {card.value}
              </p>
              <p
                className="dark:text-muted-foreground mt-1 text-xs font-semibold
                  wrap-break-word text-slate-600"
              >
                {card.delta}
              </p>
            </article>
          ))}
        </section>
      </section>

      <section className="mt-4 lg:mt-6">
        <article
          className="dark:border-border dark:bg-card bg-white min-w-0 rounded-xl
            dark:border shadow-sm border-slate-300 p-4 sm:p-5"
        >
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="dark:border-border dark:text-foreground rounded-md
                  border border-slate-200 bg-emerald-100 p-1.5 text-slate-600
                  dark:bg-emerald-900/50"
              >
                <TrendingUp className="size-4" />
              </span>
              <h2
                className="dark:text-foreground text-base font-black
                  text-slate-600 lowercase"
              >
                monthly collections
              </h2>
            </div>
            <MonthPicker currentMonth={activeMonth} />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div
              className={metricCardClass(
                "from-indigo-50",
                "dark:from-indigo-900/20",
              )}
            >
              <p className={metricCardLabelClass}>to collect this month</p>
              <p className={metricCardValueClass}>
                ₱{(currentMonthData?.expected ?? 0).toLocaleString()}
              </p>
            </div>
            <div
              className={metricCardClass("from-sky-50", "dark:from-sky-900/20")}
            >
              <p className={metricCardLabelClass}>to collect so far</p>
              <p className={metricCardValueClass}>
                ₱{(currentMonthData?.expectedSoFar ?? 0).toLocaleString()}
              </p>
            </div>
            <div
              className={metricCardClass(
                "from-emerald-50",
                "dark:from-emerald-900/20",
              )}
            >
              <p className={metricCardLabelClass}>collected</p>
              <p className={metricCardValueClass}>
                ₱{(currentMonthData?.collected ?? 0).toLocaleString()}
              </p>
            </div>
            <div
              className={metricCardClass(
                "from-amber-50",
                "dark:from-amber-900/20",
              )}
            >
              <p className={metricCardLabelClass}>meme</p>
              <p className={metricCardValueClass}>
                ₱{(currentMonthData?.profit ?? 0).toLocaleString()}
              </p>
            </div>
            <div
              className={metricCardClass(
                "from-yellow-50",
                "dark:from-yellow-900/20",
              )}
            >
              <p className={metricCardLabelClass}>expected profit</p>
              <p className={metricCardValueClass}>
                ₱{(currentMonthData?.expectedProfit ?? 0).toLocaleString()}
              </p>
            </div>
            <div
              className={metricCardClass(
                "from-rose-50",
                "dark:from-rose-900/20",
              )}
            >
              <p className={metricCardLabelClass}>remaining profit</p>
              <p className={metricCardValueClass}>
                ₱{currentMonthRemainingProfit.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Profit per month list */}
          <div
            className="dark:border-border mt-4 border-t-2 border-slate-200 pt-3"
          >
            <p
              className="dark:text-muted-foreground mb-2 text-[10px] font-black
                tracking-widest text-slate-400 uppercase"
            >
              profit per month
            </p>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
            >
              {monthlyChartData.map((m) => {
                const progress =
                  m.expectedProfit > 0
                    ? Math.min(
                        100,
                        Math.round((m.profit / m.expectedProfit) * 100),
                      )
                    : 0;
                const progressBg =
                  progress >= 75
                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                    : progress >= 50
                      ? "bg-amber-50 dark:bg-amber-900/20"
                      : progress >= 25
                        ? "bg-orange-50 dark:bg-orange-900/20"
                        : "bg-rose-50 dark:bg-rose-900/20";
                const progressBar =
                  progress >= 75
                    ? "bg-emerald-500"
                    : progress >= 50
                      ? "bg-amber-500"
                      : progress >= 25
                        ? "bg-orange-500"
                        : "bg-rose-500";
                return (
                  <div
                    key={m.label}
                    className={`dark:border-border flex flex-col gap-1
                    rounded-lg dark:border shadow-sm px-2.5 py-2 ${progressBg}`}
                  >
                    <p
                      className="dark:text-muted-foreground text-[10px]
                        font-black tracking-wide text-slate-500 uppercase"
                    >
                      {m.fullLabel}
                    </p>
                    <p
                      className="dark:text-foreground mt-0.5 text-sm font-black
                        text-slate-600 tabular-nums"
                    >
                      ₱{m.profit.toLocaleString()}
                    </p>
                    <p
                      className="dark:text-muted-foreground text-[10px]
                        font-semibold text-slate-500"
                    >
                      expected ₱{m.expectedProfit.toLocaleString()}
                    </p>
                    {/* Progress bar */}
                    <div
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-full
                        bg-black/5 dark:bg-white/10"
                    >
                      <div
                        className={`h-full rounded-full ${progressBar}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[9px] font-semibold text-slate-400">
                      {progress}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      {profitPerCategory.length > 0 && (
        <section className="mt-4 lg:mt-6">
          <article
            className="dark:border-border dark:bg-card bg-background min-w-0
              rounded-xl dark:border shadow-sm border-slate-300 p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <span
                className="dark:border-border dark:text-foreground rounded-md
                  border border-slate-200 bg-violet-100 p-1.5 text-slate-600
                  dark:bg-violet-900/50"
              >
                <TrendingUp className="size-4" />
              </span>
              <h2
                className="dark:text-foreground text-base font-black
                  text-slate-600 lowercase"
              >
                profit per category
              </h2>
            </div>
            <div
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
            >
              {profitPerCategory.map((c) => (
                <div
                  key={c.id}
                  className="dark:border-border rounded-lg dark:border
                    bg-linear-to-br from-violet-50 via-stone-50 to-white px-3
                    py-2.5 dark:from-violet-900/20 dark:via-zinc-900/40
                    dark:to-zinc-900/60"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{
                        backgroundColor: c.color ?? "#cbd5e1",
                      }}
                    />
                    <p
                      className="dark:text-muted-foreground min-w-0 text-[10px]
                        font-black tracking-wide text-slate-500 uppercase
                        truncate"
                    >
                      {c.name}
                    </p>
                  </div>
                  <p
                    className="text-xl font-semibold text-slate-600 tabular-nums
                      dark:text-violet-300"
                  >
                    ₱{c.profit.toLocaleString()}
                  </p>
                  <div className="mt-1 flex gap-3">
                    <p
                      className="text-[10px] font-semibold tabular-nums
                        text-slate-500 dark:text-slate-400"
                    >
                      collected{" "}
                      <span className="text-[#76a188]">
                        ₱{c.collected.toLocaleString()}
                      </span>
                    </p>
                    <p
                      className="text-[10px] font-semibold tabular-nums
                        text-slate-500 dark:text-slate-400"
                    >
                      remaining{" "}
                      <span className="text-[#945d5d]">
                        ₱{c.remaining.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      <section className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1fr_1fr]">
        <Link
          href="/due-this-month"
          className="dark:border-border dark:bg-card flex flex-col
            justify-between rounded-xl border border-slate-300 bg-white p-4
            transition hover:bg-slate-50 sm:p-5 dark:hover:bg-muted/50"
        >
          <div className="flex items-center justify-between">
            <h2
              className="dark:text-foreground text-base font-black
                text-slate-600 lowercase"
            >
              due this month
            </h2>
            <span
              className="dark:bg-card dark:text-muted-foreground inline-flex
                items-center gap-1.5 rounded-md border border-slate-300 bg-white
                px-2 py-1 text-xs font-bold text-slate-600 uppercase"
            >
              {thisMonthSchedules.length} schedule
              {thisMonthSchedules.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="dark:text-muted-foreground mt-2 text-sm text-slate-600">
            View all payment schedules due within the current calendar month,
            grouped by borrower.
          </p>
        </Link>

        <article
          className="dark:border-border dark:bg-card rounded-xl border
            border-slate-300 bg-white p-4 sm:p-5"
        >
          <h2
            className="dark:text-foreground mb-3 text-base font-black
              text-slate-600 lowercase"
          >
            quick actions
          </h2>
          <div className="space-y-2">
            <Link
              href="/borrowers"
              className="dark:border-border dark:text-foreground flex
                items-center justify-between rounded-lg border border-slate-300
                bg-emerald-100 px-3 py-2 text-sm font-bold text-slate-600
                lowercase transition hover:bg-emerald-200 dark:bg-emerald-900/40
                dark:hover:bg-emerald-900/60"
            >
              add borrower
              <UserRoundPlus className="size-4" />
            </Link>
            <Link
              href="/categories"
              className="dark:border-border dark:text-foreground flex
                items-center justify-between rounded-lg border border-slate-300
                bg-sky-100 px-3 py-2 text-sm font-bold text-slate-600 lowercase
                transition hover:bg-sky-200 dark:bg-sky-900/40
                dark:hover:bg-sky-900/60"
            >
              manage categories
              <Plus className="size-4" />
            </Link>
            <Link
              href="/upcoming"
              className="dark:border-border dark:text-foreground flex
                items-center justify-between rounded-lg border border-slate-300
                bg-violet-100 px-3 py-2 text-sm font-bold text-slate-600
                lowercase transition hover:bg-violet-200 dark:bg-violet-900/40
                dark:hover:bg-violet-900/60"
            >
              upcoming due dates
              <Bell className="size-4" />
            </Link>
            <Link
              href="/audit"
              className="dark:border-border dark:bg-muted dark:text-foreground
                dark:hover:bg-muted/80 flex items-center justify-between
                rounded-lg border border-slate-300 bg-slate-100 px-3 py-2
                text-sm font-bold text-slate-600 lowercase transition
                hover:bg-slate-200"
            >
              audit trail
              <ClipboardList className="size-4" />
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-4 flex justify-end lg:mt-6">
        <ResetCacheButton />
      </section>
    </main>
  );
}
