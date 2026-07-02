import { CalendarDays, ChevronDown } from "lucide-react";
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
  term_months: number | null;
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
          sort_order: number | null;
        }
      | Array<{
          id: string;
          name: string;
          color: string | null;
          sort_order: number | null;
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

  let thisMonthSchedules = allSchedules.filter(
    (row) => row.due_date >= startOfMonthDate && row.due_date <= endOfMonthDate,
  );

  const accountIds = [...new Set(thisMonthSchedules.map((s) => s.account_id))];

  let accountsById = new Map<string, AccountRef>();
  let borrowersById = new Map<string, BorrowerRef>();

  if (accountIds.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select(
        "id, borrower_id, payment_frequency, principal_amount, term_months",
      )
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
              color,
              sort_order
            )
          )
        `,
        )
        .in("id", borrowerIds);
      const borrowers = (borrowersData ?? []) as BorrowerRef[];
      borrowersById = new Map(borrowers.map((row) => [row.id, row]));
    }
  }

  // Exclude schedules for deleted accounts so profit aligns with dashboard
  const validAccountIds = new Set(accountsById.keys());
  thisMonthSchedules = thisMonthSchedules.filter((row) =>
    validAccountIds.has(row.account_id),
  );

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
    const sortOrder =
      entries.find((e) => e.sort_order != null)?.sort_order ?? null;
    return { label, color, sortOrder };
  };

  const grouped = new Map<
    string,
    {
      borrowerId: string | null;
      name: string;
      category: string;
      categoryColor: string | null;
      categorySortOrder: number | null;
      schedules: Array<{
        id: string;
        accountId: string;
        dueDate: string;
        amountDue: number;
        amountPaid: number;
        remaining: number;
        status: string;
      }>;
    }
  >();

  const orphanSchedules: {
    id: string;
    accountId: string;
    dueDate: string;
    amountDue: number;
    amountPaid: number;
    remaining: number;
    status: string;
  }[] = [];

  for (const schedule of thisMonthSchedules) {
    const account = accountsById.get(schedule.account_id);
    const borrower = account ? borrowersById.get(account.borrower_id) : null;

    const scheduleItem = {
      id: schedule.id,
      accountId: schedule.account_id,
      dueDate: schedule.due_date,
      amountDue: Number(schedule.amount_due ?? 0),
      amountPaid: Number(schedule.amount_paid ?? 0),
      remaining: remainingOnInstallment(schedule),
      status: schedule.status,
    };

    if (!borrower) {
      orphanSchedules.push(scheduleItem);
      continue;
    }

    const borrowerId = borrower.id;
    const key = borrowerId;

    if (!grouped.has(key)) {
      const meta = borrowerCategoryMeta(borrower);
      grouped.set(key, {
        borrowerId,
        name: `${borrower.first_name} ${borrower.last_name}`,
        category: meta.label,
        categoryColor: meta.color,
        categorySortOrder: meta.sortOrder,
        schedules: [],
      });
    }

    grouped.get(key)!.schedules.push(scheduleItem);
  }

  // Aggregate orphan schedules into a single unassigned entry
  if (orphanSchedules.length > 0) {
    grouped.set("__unassigned__", {
      borrowerId: null,
      name: "unassigned",
      category: "uncategorized",
      categoryColor: null,
      categorySortOrder: null,
      schedules: orphanSchedules,
    });
  }

  for (const entry of grouped.values()) {
    entry.schedules.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  const borrowers = Array.from(grouped.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  // type-augment so TS knows about categorySortOrder below

  const principalByAccountId = new Map(
    [...accountsById.values()].map((a) => [
      a.id,
      Number(a.principal_amount ?? 0),
    ]),
  );
  const totalInstallmentsByAccount = new Map(
    [...accountsById.values()].map((a) => {
      const term = Number(a.term_months ?? 1);
      const freq = a.payment_frequency ?? "monthly";
      let n = term;
      if (freq === "weekly") n = term * 4;
      else if (freq === "bimonthly") n = term * 2;
      return [a.id, Math.max(1, n)];
    }),
  );

  function scheduleProfit(s: { accountId: string; amountPaid: number }) {
    const principal = principalByAccountId.get(s.accountId) ?? 0;
    const total = totalInstallmentsByAccount.get(s.accountId) ?? 1;
    const paid = Math.max(0, s.amountPaid);
    return Math.max(0, paid - principal / total);
  }

  // Group borrowers by category
  const borrowersByCategory = new Map<
    string,
    {
      label: string;
      color: string | null;
      sortOrder: number | null;
      pending: typeof borrowers;
      paid: typeof borrowers;
      pendingTotal: number;
      paidTotal: number;
      pendingProfit: number;
      paidProfit: number;
    }
  >();

  for (const b of borrowers) {
    const key = b.category;
    if (!borrowersByCategory.has(key)) {
      borrowersByCategory.set(key, {
        label: key,
        color: b.categoryColor,
        sortOrder: b.categorySortOrder,
        pending: [],
        paid: [],
        pendingTotal: 0,
        paidTotal: 0,
        pendingProfit: 0,
        paidProfit: 0,
      });
    }
    const entry = borrowersByCategory.get(key)!;
    if (b.schedules.some((s) => s.status !== "paid")) {
      entry.pending.push(b);
      entry.pendingTotal += b.schedules.reduce(
        (sum, s) => sum + s.remaining,
        0,
      );
      entry.pendingProfit += b.schedules.reduce(
        (sum, s) => sum + scheduleProfit(s),
        0,
      );
    } else {
      entry.paid.push(b);
      entry.paidTotal += b.schedules.reduce((sum, s) => sum + s.amountPaid, 0);
      entry.paidProfit += b.schedules.reduce(
        (sum, s) => sum + scheduleProfit(s),
        0,
      );
    }
  }

  const minDueDay = (entry: {
    pending: { schedules: { dueDate: string }[] }[];
    paid: { schedules: { dueDate: string }[] }[];
  }) => {
    const days = [...entry.pending, ...entry.paid]
      .flatMap((b) => b.schedules)
      .map((s) => parseInt(s.dueDate.slice(8, 10), 10));
    return days.length > 0 ? Math.min(...days) : 999;
  };

  const categoryEntries = Array.from(borrowersByCategory.values()).sort(
    (a, b) => {
      const aHas = a.sortOrder != null;
      const bHas = b.sortOrder != null;
      if (aHas && bHas) return a.sortOrder! - b.sortOrder!;
      if (aHas) return -1;
      if (bHas) return 1;
      return minDueDay(a) - minDueDay(b) || a.label.localeCompare(b.label);
    },
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TZ,
    });

  type ScheduleRow = {
    id: string;
    accountId: string;
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

  const totalCollectedFromPending = categoryEntries.reduce(
    (sum, cat) =>
      sum +
      cat.pending.reduce(
        (s, b) => s + b.schedules.reduce((sc, sch) => sc + sch.amountPaid, 0),
        0,
      ),
    0,
  );

  const totalPaidAmount = categoryEntries.reduce(
    (sum, cat) => sum + cat.paidTotal,
    0,
  );

  const totalProfit = categoryEntries.reduce(
    (sum, cat) => sum + cat.pendingProfit + cat.paidProfit,
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
      <section className="mb-4 grid gap-3 lg:mb-6">
        <div
          className="dark:border-border dark:via-card min-w-0 rounded-xl border
            border-slate-400 bg-linear-to-br from-orange-50 via-stone-50
            to-amber-100 p-5 sm:p-6 dark:from-orange-950/30
            dark:to-amber-950/30"
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
            ₱{totalCollectedFromPending.toLocaleString()} collected · ₱
            {totalPendingAmount.toLocaleString()} remaining
          </p>

          <details
            className="group mt-3 border-t border-slate-300/60 pt-2
              dark:border-slate-700/40"
          >
            <summary
              className="flex cursor-pointer list-none items-center gap-1
                text-[10px] font-bold tracking-wide text-slate-500 uppercase
                transition hover:text-slate-700"
            >
              <span>breakdown</span>
              <ChevronDown
                className="size-3 shrink-0 transition-transform
                  group-open:rotate-180"
              />
            </summary>
            <ul className="mt-2 space-y-1.5">
              {categoryEntries
                .filter(
                  (c) =>
                    c.pending.reduce(
                      (s, b) =>
                        s +
                        b.schedules.reduce((sc, sch) => sc + sch.amountPaid, 0),
                      0,
                    ) > 0 ||
                    c.pending.reduce(
                      (s, b) =>
                        s +
                        b.schedules.reduce((sc, sch) => sc + sch.remaining, 0),
                      0,
                    ) > 0,
                )
                .map((c) => {
                  const catPaid = c.pending.reduce(
                    (s, b) =>
                      s +
                      b.schedules.reduce((sc, sch) => sc + sch.amountPaid, 0),
                    0,
                  );
                  const catRemaining = c.pending.reduce(
                    (s, b) =>
                      s +
                      b.schedules.reduce((sc, sch) => sc + sch.remaining, 0),
                    0,
                  );
                  return (
                    <li
                      key={c.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-500">
                        {c.label}
                      </span>
                      <span className="font-bold text-slate-700">
                        ₱{catPaid.toLocaleString()}
                        <span className="mx-0.5 text-slate-300">·</span>₱
                        {catRemaining.toLocaleString()}
                        <span
                          className="ml-1 text-[10px] font-medium
                            text-slate-400"
                        >
                          ({c.pending.length} borrower
                          {c.pending.length === 1 ? "" : "s"})
                        </span>
                      </span>
                    </li>
                  );
                })}
              <li
                className="flex items-center justify-between border-t
                  border-slate-300/60 pt-1.5 text-xs dark:border-slate-700/40"
              >
                <span
                  className="font-bold tracking-wide text-slate-600 uppercase"
                >
                  total
                </span>
                <span className="font-black text-slate-800">
                  ₱{totalCollectedFromPending.toLocaleString()}
                  <span className="mx-0.5 text-slate-300">·</span>₱
                  {totalPendingAmount.toLocaleString()}
                </span>
              </li>
            </ul>
          </details>
        </div>
        <div
          className="dark:border-border dark:via-card min-w-0 rounded-xl border
            border-slate-400 bg-linear-to-br from-emerald-50 via-stone-50
            to-lime-100 p-5 sm:p-6 dark:from-emerald-950/30 dark:to-lime-950/30"
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
            ₱{totalPaidAmount.toLocaleString()} total collected
          </p>

          <details
            className="group mt-3 border-t border-slate-300/60 pt-2
              dark:border-slate-700/40"
          >
            <summary
              className="flex cursor-pointer list-none items-center gap-1
                text-[10px] font-bold tracking-wide text-slate-500 uppercase
                transition hover:text-slate-700"
            >
              <span>breakdown</span>
              <ChevronDown
                className="size-3 shrink-0 transition-transform
                  group-open:rotate-180"
              />
            </summary>
            <ul className="mt-2 space-y-1.5">
              {categoryEntries
                .filter((c) => c.paidTotal > 0)
                .map((c) => (
                  <li
                    key={c.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-500">
                      {c.label}
                    </span>
                    <span className="font-bold text-slate-700">
                      ₱{c.paidTotal.toLocaleString()}
                      <span
                        className="ml-1 text-[10px] font-medium text-slate-400"
                      >
                        ({c.paid.length} borrower
                        {c.paid.length === 1 ? "" : "s"})
                      </span>
                    </span>
                  </li>
                ))}
              <li
                className="flex items-center justify-between border-t
                  border-slate-300/60 pt-1.5 text-xs dark:border-slate-700/40"
              >
                <span
                  className="font-bold tracking-wide text-slate-600 uppercase"
                >
                  total
                </span>
                <span className="font-black text-slate-800">
                  ₱{totalPaidAmount.toLocaleString()}
                </span>
              </li>
            </ul>
          </details>
        </div>
        <div
          className="dark:border-border dark:via-card min-w-0 rounded-xl border
            border-slate-400 bg-linear-to-br from-amber-50 via-stone-50
            to-yellow-100 p-5 sm:p-6 dark:from-amber-950/30
            dark:to-yellow-950/30"
        >
          <p
            className="dark:text-muted-foreground text-xs font-bold
              tracking-wide text-slate-600 uppercase"
          >
            profit collected
          </p>
          <p
            className="dark:text-foreground mt-1 text-2xl font-black
              text-slate-600"
          >
            ₱{totalProfit.toLocaleString()}
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
