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
import { SummaryCards } from "@/components/components-2/dashboard/summary-cards";
import { MonthlyCollections } from "@/components/components-2/dashboard/monthly-collections";
import { ProfitPerMonth } from "@/components/components-2/dashboard/profit-per-month";
import { ProfitPerCategory } from "@/components/components-2/dashboard/profit-per-category";
import { SidePanel } from "@/components/components-2/dashboard/side-panel";
import type {
  DashboardSummary,
  CurrentMonthData,
  ProfitCategoryItem,
  MonthlyProfit,
} from "@/lib/dashboard-data";

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
    const paid = Number(row.amount_paid ?? 0);
    const due = Number(row.amount_due ?? 0);
    const remaining = Math.max(0, due - paid);
    const profit = paid + remaining;
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

  const summary: DashboardSummary = {
    activeBorrowers: borrowerCount ?? 0,
    activeBorrowersDelta: newBorrowersWeekCount,
    duesToday: dueTotalToday,
    duesTodaySchedules: dueSchedulesCount,
    avgMonthlyProfit,
  };

  const currentMonth: CurrentMonthData = {
    label: currentMonthData?.fullLabel ?? activeMonth,
    toCollectThisMonth: currentMonthData?.expected ?? 0,
    toCollectSoFar: currentMonthData?.expectedSoFar ?? 0,
    collected: currentMonthData?.collected ?? 0,
    meme: currentMonthData?.profit ?? 0,
    expectedProfit: currentMonthData?.expectedProfit ?? 0,
    remainingProfit: currentMonthRemainingProfit,
  };

  const profitPerMonth: MonthlyProfit[] = monthlyChartData.map((m) => ({
    month: m.fullLabel,
    short: m.label,
    actual: m.profit,
    expected: m.expectedProfit,
    percent:
      m.expectedProfit > 0
        ? Math.min(100, Math.round((m.profit / m.expectedProfit) * 100))
        : 0,
  }));

  const profitPerCategoryData: ProfitCategoryItem[] = profitPerCategory;

  return (
    <main className="mx-auto px-4 py-6 pb-20 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider
              text-muted-foreground"
          >
            {formattedToday}
          </p>
          <h1
            className="mt-1 text-2xl font-black lowercase text-slate-600
              dark:text-foreground sm:text-3xl"
          >
            utangz dashboard
          </h1>
          <p
            className="mt-2 text-sm text-slate-700 dark:text-muted-foreground
              sm:max-w-xl"
          >
            Quick glance on active collections, upcoming dues, and account
            movement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker currentMonth={activeMonth} />
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-6">
        <SummaryCards summary={summary} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <MonthlyCollections currentMonth={currentMonth} />
          <ProfitPerMonth profitPerMonth={profitPerMonth} />
          {profitPerCategoryData.length > 0 && (
            <ProfitPerCategory profitPerCategory={profitPerCategoryData} />
          )}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SidePanel dueThisMonthSchedules={thisMonthSchedules.length} />
        </div>
      </div>
    </main>
  );
}
