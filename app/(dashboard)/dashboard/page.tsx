import type { CSSProperties } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { logPageView } from "@/lib/audit";
import {
  principalShare,
  profitOnInstallment,
  type AccountTerms,
} from "@/lib/checklist/profit";
import { getAllPaymentSchedules } from "@/lib/cache/schedules";
import {
  isInstallmentFullyPaid,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import MonthPicker from "@/components/month-picker";
import { SummaryCards } from "@/components/components-2/dashboard/summary-cards";
import { MonthlyCollections } from "@/components/components-2/dashboard/monthly-collections";
import { ProfitPerMonth } from "@/components/components-2/dashboard/profit-per-month";
import { LoansReleased } from "@/components/components-2/dashboard/loans-released";
import { OverdueAging } from "@/components/components-2/dashboard/overdue-aging";
import { ProfitPerCategory } from "@/components/components-2/dashboard/profit-per-category";
import {
  WalletHome,
  type RecentPayment,
} from "@/components/components-2/dashboard/wallet-home";
import { SidePanel } from "@/components/components-2/dashboard/side-panel";
import type {
  DashboardSummary,
  CurrentMonthData,
  ProfitCategoryItem,
  MonthlyProfit,
  OverdueBucket,
  OverdueBorrower,
} from "@/lib/dashboard-data";

type AccountTotalRow = {
  id: string;
  borrower_id: string;
  status: string | null;
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

type BorrowerNameRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

const TZ = "Asia/Manila";
const CHART_MONTHS = 12;
const AVG_PROFIT_MONTHS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Shift a YYYY-MM-DD date by whole days without touching local timezones. */
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) /
      DAY_MS,
  );
}

function monthKeyOffset(monthKey: string, offset: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(monthKey: string, month: "short" | "long") {
  return new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month,
    year: month === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

const AGING_BUCKETS = [
  { label: "1–7 days", max: 7 },
  { label: "8–30 days", max: 30 },
  { label: "31–60 days", max: 60 },
  { label: "61–90 days", max: 90 },
  { label: "90+ days", max: Infinity },
];

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; view?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createSupabaseServer();
  await logPageView("/dashboard");
  const now = new Date();
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const todayMonth = todayIso.slice(0, 7);
  const isValid = /^\d{4}-\d{2}$/.test(params.month ?? "");
  const activeMonth = isValid ? params.month! : todayMonth;
  const weekAgoDate = addDays(todayIso, -7);

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
        "id, borrower_id, status, principal_amount, release_date, term_months, payment_frequency",
      )
      .is("deleted_at", null),
    supabase.from("borrower_categories").select("borrower_id, category_id"),
    supabase.from("categories").select("id, name, color"),
    getAllPaymentSchedules(),
  ]);

  const accountTotals = (accountTotalsData ?? []) as AccountTotalRow[];
  const validAccountIds = new Set(accountTotals.map((a) => a.id));
  const schedules = allSchedules.filter((row) =>
    validAccountIds.has(row.account_id),
  );
  const openSchedules = schedules.filter((row) => !isInstallmentFullyPaid(row));

  const accountBorrowerById = new Map(
    accountTotals.map((a) => [a.id, a.borrower_id]),
  );
  const principalPerInstallmentByAccount = new Map(
    accountTotals.map((a) => {
      const term = Number(a.term_months ?? 1);
      const freq = a.payment_frequency ?? "monthly";
      let n = term;
      if (freq === "weekly") n = term * 4;
      else if (freq === "bimonthly") n = term * 2;
      return [a.id, Number(a.principal_amount ?? 0) / Math.max(1, n)];
    }),
  );

  // ── Per-month rollup ────────────────────────────────────────────────
  // profit = amount_paid − principal_per_installment (interest collected)
  type MonthStats = {
    expected: number;
    expectedSoFar: number;
    collected: number;
    profit: number;
    expectedProfit: number;
    released: number;
    releasedCount: number;
  };
  const statsByMonth = new Map<string, MonthStats>();
  const monthStats = (key: string) => {
    let s = statsByMonth.get(key);
    if (!s) {
      s = {
        expected: 0,
        expectedSoFar: 0,
        collected: 0,
        profit: 0,
        expectedProfit: 0,
        released: 0,
        releasedCount: 0,
      };
      statsByMonth.set(key, s);
    }
    return s;
  };
  for (const row of schedules) {
    const s = monthStats(row.due_date.slice(0, 7));
    const due = Number(row.amount_due ?? 0);
    const paid = Number(row.amount_paid ?? 0);
    const principalShare =
      principalPerInstallmentByAccount.get(row.account_id) ?? 0;
    s.expected += due;
    if (row.due_date <= todayIso) s.expectedSoFar += due;
    s.collected += paid;
    s.expectedProfit += Math.max(0, due - principalShare);
    s.profit += Math.max(0, paid - principalShare);
  }
  for (const a of accountTotals) {
    if (a.status === "pending" || !a.release_date) continue;
    const s = monthStats(a.release_date.slice(0, 7));
    s.released += Number(a.principal_amount ?? 0);
    s.releasedCount += 1;
  }

  const profitPerMonth: MonthlyProfit[] = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const key = monthKeyOffset(activeMonth, -i);
    const s = monthStats(key);
    profitPerMonth.push({
      key,
      month: monthLabel(key, "long"),
      short: monthLabel(key, "short"),
      actual: Math.round(s.profit),
      expected: Math.round(s.expectedProfit),
      percent:
        s.expectedProfit > 0
          ? Math.min(100, Math.round((s.profit / s.expectedProfit) * 100))
          : 0,
      collected: Math.round(s.collected),
      due: Math.round(s.expected),
      released: Math.round(s.released),
      releasedCount: s.releasedCount,
      isCurrent: key === todayMonth,
      isFuture: key > todayMonth,
    });
  }

  const active = monthStats(activeMonth);
  const currentMonth: CurrentMonthData = {
    label: monthLabel(activeMonth, "long"),
    toCollectThisMonth: Math.round(active.expected),
    toCollectSoFar: Math.round(active.expectedSoFar),
    collected: Math.round(active.collected),
    meme: Math.round(active.profit),
    expectedProfit: Math.round(active.expectedProfit),
    remainingProfit: Math.round(
      Math.max(0, active.expectedProfit - active.profit),
    ),
  };

  // Trailing average over completed months that had any lending activity,
  // so months before the first loan don't drag the average down.
  const trailingMonths = Array.from({ length: AVG_PROFIT_MONTHS }, (_, i) =>
    monthStats(monthKeyOffset(todayMonth, -(i + 1))),
  ).filter((s) => s.expected > 0 || s.profit > 0);
  const avgMonthlyProfit =
    trailingMonths.length > 0
      ? Math.round(
          trailingMonths.reduce((sum, s) => sum + s.profit, 0) /
            trailingMonths.length,
        )
      : 0;

  // ── Portfolio health (always as of today) ───────────────────────────
  let outstanding = 0;
  // The part of `outstanding` that is interest still to be collected.
  let outstandingProfit = 0;
  let dueTotalToday = 0;
  let dueTodayCount = 0;
  const activeLoanIds = new Set<string>();
  const overdueBuckets: OverdueBucket[] = AGING_BUCKETS.map((b) => ({
    label: b.label,
    amount: 0,
    count: 0,
  }));
  const overdueByBorrower = new Map<
    string,
    { amount: number; oldestDaysLate: number }
  >();
  let overdueTotal = 0;
  let overdueCount = 0;

  for (const row of openSchedules) {
    const remaining = remainingOnInstallment(row);
    if (remaining <= 0) continue;
    outstanding += remaining;
    {
      const share = principalPerInstallmentByAccount.get(row.account_id) ?? 0;
      const profitDue = Math.max(0, Number(row.amount_due ?? 0) - share);
      const profitPaid = Math.max(0, Number(row.amount_paid ?? 0) - share);
      outstandingProfit += Math.min(
        remaining,
        Math.max(0, profitDue - profitPaid),
      );
    }
    activeLoanIds.add(row.account_id);

    if (row.due_date === todayIso) {
      dueTotalToday += remaining;
      dueTodayCount += 1;
    }

    if (row.due_date < todayIso) {
      const daysLate = daysBetween(row.due_date, todayIso);
      const bucket = AGING_BUCKETS.findIndex((b) => daysLate <= b.max);
      overdueBuckets[bucket].amount += remaining;
      overdueBuckets[bucket].count += 1;
      overdueTotal += remaining;
      overdueCount += 1;
      const borrowerId = accountBorrowerById.get(row.account_id);
      if (borrowerId) {
        const cur = overdueByBorrower.get(borrowerId) ?? {
          amount: 0,
          oldestDaysLate: 0,
        };
        cur.amount += remaining;
        cur.oldestDaysLate = Math.max(cur.oldestDaysLate, daysLate);
        overdueByBorrower.set(borrowerId, cur);
      }
    }
  }

  const topOverdueIds = [...overdueByBorrower.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5);
  const { data: overdueBorrowerNames } = topOverdueIds.length
    ? await supabase
        .from("borrowers")
        .select("id, first_name, last_name")
        .in(
          "id",
          topOverdueIds.map(([id]) => id),
        )
    : { data: [] as BorrowerNameRow[] };
  const nameById = new Map(
    ((overdueBorrowerNames ?? []) as BorrowerNameRow[]).map((b) => [
      b.id,
      [b.first_name, b.last_name].filter(Boolean).join(" ") || "Unnamed",
    ]),
  );
  const topOverdueBorrowers: OverdueBorrower[] = topOverdueIds.map(
    ([id, s]) => ({
      id,
      name: nameById.get(id) ?? "Unknown borrower",
      amount: Math.round(s.amount),
      oldestDaysLate: s.oldestDaysLate,
    }),
  );

  const newBorrowersWeekCount = new Set(
    ((newBorrowerAccountsWeekData ?? []) as { borrower_id: string | null }[])
      .map((row) => row.borrower_id)
      .filter((id): id is string => Boolean(id)),
  ).size;

  const summary: DashboardSummary = {
    outstanding: Math.round(outstanding),
    outstandingProfit: Math.round(outstandingProfit),
    outstandingPrincipal: Math.round(outstanding - outstandingProfit),
    activeLoans: activeLoanIds.size,
    overdue: Math.round(overdueTotal),
    overdueSchedules: overdueCount,
    overdueBorrowers: overdueByBorrower.size,
    duesToday: Math.round(dueTotalToday),
    duesTodaySchedules: dueTodayCount,
    avgMonthlyProfit,
    avgMonthlyProfitMonths: trailingMonths.length,
    activeBorrowers: borrowerCount ?? 0,
    activeBorrowersDelta: newBorrowersWeekCount,
  };

  // ── Profit per category for the active month ────────────────────────
  const categories = (categoriesData ?? []) as CategoryRow[];
  const borrowerCategoriesByBorrower = new Map<string, string[]>();
  for (const row of (borrowerCategoriesData ?? []) as BorrowerCategoryRow[]) {
    const list = borrowerCategoriesByBorrower.get(row.borrower_id) ?? [];
    list.push(row.category_id);
    borrowerCategoriesByBorrower.set(row.borrower_id, list);
  }
  const statsByCategory = new Map<
    string,
    { collectedProfit: number; remainingProfit: number }
  >();
  for (const row of schedules) {
    if (!row.due_date.startsWith(activeMonth)) continue;
    const borrowerId = accountBorrowerById.get(row.account_id);
    if (!borrowerId) continue;
    const categoryIds = borrowerCategoriesByBorrower.get(borrowerId) ?? [];
    if (categoryIds.length === 0) continue;
    const principalShare =
      principalPerInstallmentByAccount.get(row.account_id) ?? 0;
    const expectedProfit = Math.max(
      0,
      Number(row.amount_due ?? 0) - principalShare,
    );
    const collectedProfit = Math.max(
      0,
      Number(row.amount_paid ?? 0) - principalShare,
    );
    const remainingProfit = Math.max(0, expectedProfit - collectedProfit);
    for (const categoryId of categoryIds) {
      const cur = statsByCategory.get(categoryId) ?? {
        collectedProfit: 0,
        remainingProfit: 0,
      };
      cur.collectedProfit += collectedProfit;
      cur.remainingProfit += remainingProfit;
      statsByCategory.set(categoryId, cur);
    }
  }
  const profitPerCategory: ProfitCategoryItem[] = categories
    .map((c) => {
      const stats = statsByCategory.get(c.id);
      const collectedProfit = Math.round(stats?.collectedProfit ?? 0);
      const remainingProfit = Math.round(stats?.remainingProfit ?? 0);
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        profit: collectedProfit + remainingProfit,
        collectedProfit,
        remainingProfit,
      };
    })
    .filter((c) => c.profit > 0)
    .sort((a, b) => b.profit - a.profit);

  const dueThisMonthCount = schedules.filter((row) =>
    row.due_date.startsWith(activeMonth),
  ).length;

  const formattedToday = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });

  const hour = Number(
    now.toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: TZ,
    }),
  );
  const greeting =
    hour < 12 ? "good morning" : hour < 18 ? "good afternoon" : "good evening";

  // Stagger index for the entrance animation, in reading order.
  const rise = (i: number) => ({ "--rise-i": i }) as CSSProperties;

  if (params.view !== "classic") {
    type AccountInfo = AccountTerms & {
      id: string;
      type: string | null;
      interest_type: string | null;
      interest_rate: number | null;
      borrowers: unknown;
    };
    type ScheduleInfo = { due_date: string | null; accounts: unknown };
    type PaymentRow = {
      id: string;
      schedule_id: string;
      amount: number | null;
      payment_date: string | null;
      created_at: string;
      payment_schedules: unknown;
    };
    const { data: paymentRows } = await supabase
      .from("schedule_payments")
      .select(
        "id, schedule_id, amount, payment_date, created_at, payment_schedules(due_date, accounts(id, type, interest_type, interest_rate, principal_amount, term_months, payment_frequency, term_installments, schedule_mode, borrowers(id, first_name, last_name)))",
      )
      .order("created_at", { ascending: false })
      .limit(6);
    const recent = (paymentRows ?? []) as PaymentRow[];
    // Everything already paid on those installments, to split each payment's
    // profit from what came before it.
    const { data: siblingRows } = recent.length
      ? await supabase
          .from("schedule_payments")
          .select("id, schedule_id, amount, created_at")
          .in("schedule_id", [...new Set(recent.map((r) => r.schedule_id))])
      : {
          data: [] as Omit<PaymentRow, "payment_date" | "payment_schedules">[],
        };
    const siblings = (siblingRows ?? []) as Omit<
      PaymentRow,
      "payment_date" | "payment_schedules"
    >[];
    const one = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    const shortDay = (day: string) =>
      day === todayIso
        ? "Today"
        : day === addDays(todayIso, -1)
          ? "Yesterday"
          : new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            });
    const payments: RecentPayment[] = recent.map((row) => {
      const schedule = one(row.payment_schedules as ScheduleInfo | null);
      const account = one(schedule?.accounts as AccountInfo | null);
      const borrower = one(account?.borrowers as BorrowerNameRow | null);
      const amount = Number(row.amount ?? 0);
      const before = siblings
        .filter(
          (o) =>
            o.schedule_id === row.schedule_id &&
            (o.created_at < row.created_at ||
              (o.created_at === row.created_at && o.id < row.id)),
        )
        .reduce((sum, o) => sum + Number(o.amount ?? 0), 0);
      const share = principalShare(account);
      const profit = account
        ? profitOnInstallment(before + amount, share) -
          profitOnInstallment(before, share)
        : null;
      const day = row.payment_date ?? row.created_at.slice(0, 10);
      return {
        id: row.id,
        borrowerId: borrower?.id ?? null,
        accountId: account?.id ?? null,
        name:
          [borrower?.first_name, borrower?.last_name]
            .filter(Boolean)
            .join(" ") || "Unknown borrower",
        amount,
        date: shortDay(day),
        loanType: account?.type ?? null,
        frequency: account?.payment_frequency ?? null,
        rate: account?.interest_rate ?? null,
        dueDate: schedule?.due_date ? shortDay(schedule.due_date) : null,
        profit,
      };
    });
    // The global top bar steps aside here, so pull up over its offset.
    return (
      <main className="relative mx-auto -mt-16 px-4 pt-3 pb-20 sm:mt-0 sm:py-6">
        <WalletHome
          summary={summary}
          currentMonth={currentMonth}
          activeMonth={activeMonth}
          profitPerMonth={profitPerMonth}
          overdueBuckets={overdueBuckets.map((b) => ({
            ...b,
            amount: Math.round(b.amount),
          }))}
          topOverdue={topOverdueBorrowers}
          payments={payments}
        />
      </main>
    );
  }

  return (
    <main className="relative isolate mx-auto px-4 py-6 pb-20 lg:px-8">
      {/* Faint brand-colored glow behind the header; decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64
          bg-[radial-gradient(60%_100%_at_15%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <div className="dash-rise flex items-start justify-between gap-4">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider
              text-muted-foreground"
          >
            {formattedToday} · {greeting} 👋
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
            Portfolio health, profit trends, and what&apos;s coming in.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SummaryCards summary={summary} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="flex items-center gap-2 pt-2">
            <MonthPicker currentMonth={activeMonth} />
          </div>
          <div className="dash-rise" style={rise(6)}>
            <MonthlyCollections currentMonth={currentMonth} />
          </div>
          <div className="dash-rise" style={rise(7)}>
            <ProfitPerMonth profitPerMonth={profitPerMonth} />
          </div>
          <div className="dash-rise" style={rise(8)}>
            <LoansReleased months={profitPerMonth} />
          </div>
          {profitPerCategory.length > 0 && (
            <div className="dash-rise" style={rise(9)}>
              <ProfitPerCategory profitPerCategory={profitPerCategory} />
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div className="dash-rise" style={rise(6)}>
            <OverdueAging
              total={summary.overdue}
              buckets={overdueBuckets.map((b) => ({
                ...b,
                amount: Math.round(b.amount),
              }))}
              topBorrowers={topOverdueBorrowers}
            />
          </div>
          <div className="dash-rise" style={rise(7)}>
            <SidePanel dueThisMonthSchedules={dueThisMonthCount} />
          </div>
        </div>
      </div>
    </main>
  );
}
