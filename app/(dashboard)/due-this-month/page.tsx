import { CalendarDays } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import CategoryScrollNav from "@/components/category-scroll-nav";
import CategorySection from "@/components/category-section";
import MonthPicker from "@/components/month-picker";
import { getAllPaymentSchedules } from "@/lib/cache/schedules";
import { remainingOnInstallment } from "@/lib/payment-schedule/schedule-balances";

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

export default async function DueThisMonthPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const TZ = "Asia/Manila";

  const now = new Date();
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const defaultMonth = todayIso.slice(0, 7); // YYYY-MM

  const selectedMonth = params.month ?? defaultMonth;
  const isValid = /^\d{4}-\d{2}$/.test(selectedMonth);
  const activeMonth = isValid ? selectedMonth : defaultMonth;

  const [yearStr, monthStr] = activeMonth.split("-");
  const phtYear = Number(yearStr);
  const phtMonth = Number(monthStr);
  const startOfMonthDate = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(phtYear, phtMonth, 0).getDate();
  const endOfMonthDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const supabase = await createSupabaseServer();
  const allSchedules = await getAllPaymentSchedules();

  const thisMonthSchedules = allSchedules.filter(
    (row) => row.due_date >= startOfMonthDate && row.due_date <= endOfMonthDate,
  );

  const accountIds = [...new Set(thisMonthSchedules.map((s) => s.account_id))];

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
    return { label, color };
  };

  const grouped = new Map<
    string,
    {
      borrowerId: string | null;
      name: string;
      category: string;
      categoryColor: string | null;
      schedules: Array<{
        id: string;
        dueDate: string;
        amountDue: number;
        amountPaid: number;
        remaining: number;
        status: string;
      }>;
    }
  >();

  for (const schedule of thisMonthSchedules) {
    const account = accountsById.get(schedule.account_id);
    const borrower = account ? borrowersById.get(account.borrower_id) : null;
    if (!borrower) continue;

    const borrowerId = borrower.id;
    const key = borrowerId;

    if (!grouped.has(key)) {
      const meta = borrowerCategoryMeta(borrower);
      grouped.set(key, {
        borrowerId,
        name: `${borrower.first_name} ${borrower.last_name}`,
        category: meta.label,
        categoryColor: meta.color,
        schedules: [],
      });
    }

    grouped.get(key)!.schedules.push({
      id: schedule.id,
      dueDate: schedule.due_date,
      amountDue: Number(schedule.amount_due ?? 0),
      amountPaid: Number(schedule.amount_paid ?? 0),
      remaining: remainingOnInstallment(schedule),
      status: schedule.status,
    });
  }

  for (const entry of grouped.values()) {
    entry.schedules.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  const borrowers = Array.from(grouped.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Group borrowers by category
  const borrowersByCategory = new Map<
    string,
    {
      label: string;
      color: string | null;
      pending: typeof borrowers;
      paid: typeof borrowers;
      pendingTotal: number;
      paidTotal: number;
    }
  >();

  for (const b of borrowers) {
    const key = b.category;
    if (!borrowersByCategory.has(key)) {
      borrowersByCategory.set(key, {
        label: key,
        color: b.categoryColor,
        pending: [],
        paid: [],
        pendingTotal: 0,
        paidTotal: 0,
      });
    }
    const entry = borrowersByCategory.get(key)!;
    if (b.schedules.some((s) => s.status !== "paid")) {
      entry.pending.push(b);
      entry.pendingTotal += b.schedules.reduce(
        (sum, s) => sum + s.remaining,
        0,
      );
    } else {
      entry.paid.push(b);
      entry.paidTotal += b.schedules.reduce((sum, s) => sum + s.amountDue, 0);
    }
  }

  const categoryEntries = Array.from(borrowersByCategory.values()).sort(
    (a, b) => a.label.localeCompare(b.label),
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TZ,
    });

  type ScheduleRow = {
    id: string;
    dueDate: string;
    amountDue: number;
    amountPaid: number;
    remaining: number;
    status: string;
  };

  function groupSchedulesByDate(
    schedules: ScheduleRow[],
    getAmount: (s: ScheduleRow) => number,
  ) {
    const groups: {
      date: string;
      status: string;
      items: number[];
      total: number;
      totalPaid: number;
    }[] = [];

    for (const s of schedules) {
      const last = groups[groups.length - 1];
      if (last && last.date === s.dueDate && last.status === s.status) {
        last.items.push(getAmount(s));
        last.total += getAmount(s);
        last.totalPaid += s.amountPaid;
      } else {
        groups.push({
          date: s.dueDate,
          status: s.status,
          items: [getAmount(s)],
          total: getAmount(s),
          totalPaid: s.amountPaid,
        });
      }
    }

    return groups;
  }

  const totalPendingAmount = categoryEntries.reduce(
    (sum, cat) =>
      sum +
      cat.pending.reduce(
        (s, b) => s + b.schedules.reduce((sc, sch) => sc + sch.remaining, 0),
        0,
      ),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-0 py-2">
      <section
        className="dark:border-border dark:via-card mb-4 rounded-xl border
          border-slate-400 bg-linear-to-r from-sky-50 via-stone-50 to-indigo-100
          p-4 sm:mb-6 sm:p-6 dark:from-sky-950/50 dark:to-indigo-950/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <MonthPicker currentMonth={activeMonth} />
            <h1
              className="dark:text-foreground mt-1 text-2xl font-black
                text-slate-600 lowercase sm:text-3xl"
            >
              due this month
            </h1>
          </div>
          <span
            className="dark:border-border dark:text-foreground inline-flex
              items-center gap-1.5 rounded-md border border-slate-400 bg-white
              px-2.5 py-1 text-xs font-bold text-slate-500 uppercase
              dark:bg-card"
          >
            <CalendarDays className="size-3.5" />
            {thisMonthSchedules.length} schedule
            {thisMonthSchedules.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="dark:text-muted-foreground mt-2 text-sm text-slate-700">
          All payment schedules due within the current calendar month.
        </p>
      </section>

      {/* Summary bar */}
      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:mb-6">
        <div
          className="dark:border-border dark:via-card min-w-0 rounded-xl border
            border-slate-400 bg-linear-to-br from-orange-50 via-stone-50
            to-amber-100 p-4 dark:from-orange-950/30 dark:to-amber-950/30"
        >
          <p
            className="dark:text-muted-foreground text-xs font-bold
              tracking-wide text-slate-600 uppercase"
          >
            pending borrowers
          </p>
          <p
            className="dark:text-foreground mt-1 text-2xl font-black
              text-slate-600"
          >
            {categoryEntries.reduce((sum, c) => sum + c.pending.length, 0)}
          </p>
          <p
            className="dark:text-muted-foreground mt-0.5 text-xs font-semibold
              text-slate-500"
          >
            PHP {totalPendingAmount.toLocaleString()} remaining
          </p>
        </div>
        <div
          className="dark:border-border dark:via-card min-w-0 rounded-xl border
            border-slate-400 bg-linear-to-br from-emerald-50 via-stone-50
            to-lime-100 p-4 dark:from-emerald-950/30 dark:to-lime-950/30"
        >
          <p
            className="dark:text-muted-foreground text-xs font-bold
              tracking-wide text-slate-600 uppercase"
          >
            fully paid
          </p>
          <p
            className="dark:text-foreground mt-1 text-2xl font-black
              text-slate-600"
          >
            {categoryEntries.reduce((sum, c) => sum + c.paid.length, 0)}
          </p>
          <p
            className="dark:text-muted-foreground mt-0.5 text-xs font-semibold
              text-slate-500"
          >
            all schedules cleared this month
          </p>
        </div>
      </section>

      {/* Category shortcuts */}
      <CategoryScrollNav
        categories={categoryEntries.map((c) => ({
          label: c.label,
          color: c.color,
          pendingCount: c.pending.length,
          paidCount: c.paid.length,
        }))}
      />

      {/* Categories */}
      {categoryEntries.map((cat) => (
        <CategorySection key={cat.label} cat={cat} tz={TZ} />
      ))}
    </main>
  );
}
