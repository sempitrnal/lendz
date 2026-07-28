"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type BorrowerScheduleCardSchedule = {
  dueDate: string;
  amount: number;
  amountPaid: number;
  remaining: number;
  status: string;
};

type BorrowerLike = {
  id: string;
  first_name: string;
  last_name: string;
  borrower_categories?: {
    category?: { name?: string | null; color?: string | null } | null;
  }[];
  all_schedules?: {
    due_date: string;
    amount: number;
    amount_paid: number;
    remaining: number;
    status: string;
  }[];
  account_schedules?: {
    due_date: string;
    amount: number;
    amount_paid_total?: number;
    status: string;
  }[];
  total_paid?: number;
  total_remaining?: number;
  total_expected?: number;
  has_accounts?: boolean;
  accounts_count?: number;
  manual_total_paid?: number;
  manual_total_remaining?: number;
  manual_accounts_count?: number;
};

type BorrowerScheduleCardProps = {
  borrowerId?: string | null;
  name: string;
  category: string;
  categoryColor: string | null;
  schedules: BorrowerScheduleCardSchedule[];
  totalPaid: number;
  totalRemaining: number;
  totalExpected: number;
  variant?: "pending" | "paid" | "overview";
  tz?: string;
  children?: React.ReactNode;
  displayCategory?: boolean;
  hasAccounts?: boolean;
  manualTotalPaid?: number;
  manualTotalRemaining?: number;
  manualAccountsCount?: number;
  accountsCount?: number;
  nextSchedule?: BorrowerScheduleCardSchedule | null;
};

function formatDate(d: string, tz?: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-100";
    case "overdue":
      return "bg-rose-100 text-rose-700 dark:bg-rose-800 dark:text-rose-100";
    case "partial":
      return "bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-100";
    case "pending":
      return "bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-100";
    default:
      return "bg-sky-100 text-sky-700 dark:bg-sky-800 dark:text-sky-100";
  }
}

function getCurrentMonthKey(tz = "Asia/Manila") {
  const now = new Date();
  const iso = now.toLocaleDateString("en-CA", { timeZone: tz });
  return iso.slice(0, 7); // YYYY-MM
}

export function buildBorrowerScheduleCardProps(
  borrower: BorrowerLike,
  tz = "Asia/Manila",
) {
  const categories = (borrower.borrower_categories ?? []).flatMap((row) => {
    const category = row.category;
    if (!category) return [];
    return [category];
  });
  const firstCategory = categories[0];

  const currentMonth = getCurrentMonthKey(tz);
  const all = borrower.all_schedules ?? [];
  const account = borrower.account_schedules ?? [];
  const raw = all.length > 0 ? all : account;

  const monthSchedules = raw.filter(
    (s) => s.due_date.slice(0, 7) === currentMonth,
  );
  const schedules = monthSchedules.map((s) => {
    const remaining = (s as any).remaining ?? s.amount;
    const amountPaid =
      (s as any).amount_paid ?? (s as any).amount_paid_total ?? 0;
    const amount = s.status === "paid" ? amountPaid : remaining;
    return {
      dueDate: s.due_date,
      amount,
      amountPaid,
      remaining,
      status: s.status,
    };
  });

  const computedPaid = monthSchedules.reduce(
    (sum, s) =>
      sum + ((s as any).amount_paid ?? (s as any).amount_paid_total ?? 0),
    0,
  );
  const computedRemaining = monthSchedules.reduce(
    (sum, s) => sum + ((s as any).remaining ?? s.amount),
    0,
  );

  const manualTotalPaid = borrower.manual_total_paid ?? 0;
  const manualTotalRemaining = borrower.manual_total_remaining ?? 0;
  const manualAccountsCount = borrower.manual_accounts_count ?? 0;
  const accountsCount = borrower.accounts_count ?? raw.length;
  const isManualAccount =
    manualAccountsCount > 0 && accountsCount === manualAccountsCount;

  let totalPaid = computedPaid;
  let totalRemaining = computedRemaining;
  if (isManualAccount) {
    totalPaid = manualTotalPaid;
    totalRemaining = manualTotalRemaining;
  }

  let nextSchedule: BorrowerScheduleCardSchedule | null = null;
  if (monthSchedules.length === 0) {
    const sorted = [...raw]
      .filter((s) => s.due_date !== "9999-12-31")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const next = sorted[0];
    if (next) {
      const remaining = (next as any).remaining ?? next.amount;
      const amountPaid =
        (next as any).amount_paid ?? (next as any).amount_paid_total ?? 0;
      const amount = next.status === "paid" ? amountPaid : remaining;
      nextSchedule = {
        dueDate: next.due_date,
        amount,
        amountPaid,
        remaining,
        status: next.status,
      };
    }
  }

  const hasAccounts =
    borrower.has_accounts ?? (borrower.accounts_count ?? raw.length) > 0;

  return {
    borrowerId: borrower.id,
    name: `${borrower.first_name} ${borrower.last_name}`,
    category: firstCategory?.name ?? "uncategorized",
    categoryColor: firstCategory?.color ?? null,
    schedules,
    totalPaid,
    totalRemaining,
    totalExpected: totalPaid + totalRemaining,
    hasAccounts,
    tz,
    manualTotalPaid,
    manualTotalRemaining,
    manualAccountsCount,
    accountsCount,
    nextSchedule,
  };
}

function groupSchedulesByDate(schedules: BorrowerScheduleCardSchedule[]) {
  const groups: {
    date: string;
    status: string;
    items: BorrowerScheduleCardSchedule[];
    total: number;
    totalPaid: number;
  }[] = [];

  for (const s of schedules) {
    const last = groups[groups.length - 1];
    if (last && last.date === s.dueDate && last.status === s.status) {
      last.items.push(s);
      last.total += s.amount;
      last.totalPaid += s.amountPaid;
    } else {
      groups.push({
        date: s.dueDate,
        status: s.status,
        items: [s],
        total: s.amount,
        totalPaid: s.amountPaid,
      });
    }
  }

  return groups;
}

type ScheduleGroup = ReturnType<typeof groupSchedulesByDate>[number];

function ScheduleGroupItem({
  g,
  tz,
  label,
}: {
  g: ScheduleGroup;
  tz?: string;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p
          className="text-[10px] font-semibold text-slate-400 uppercase
            dark:text-muted-foreground"
        >
          {label && (
            <span className="font-bold text-slate-500">{label} · </span>
          )}
          {formatDate(g.date, tz)}
          {g.items.length > 1 && (
            <span className="ml-1 font-bold text-slate-300">
              (&times;{g.items.length})
            </span>
          )}
        </p>
        <p className="text-sm font-bold text-slate-700 dark:text-foreground">
          PHP {g.total.toLocaleString()}
        </p>
        {g.status === "partial" && (
          <p
            className="text-[10px] font-semibold text-slate-400
              dark:text-slate-500"
          >
            &#8369;{g.totalPaid.toLocaleString()} paid &#183; &#8369;
            {g.total.toLocaleString()} remaining
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[8px] font-black
          uppercase ${statusBadgeClasses(g.status)}`}
      >
        {g.status}
      </span>
    </div>
  );
}

export default function BorrowerScheduleCard({
  borrowerId,
  name,
  category,
  categoryColor,
  schedules,
  totalPaid,
  totalRemaining,
  totalExpected,
  variant = "overview",
  tz,
  children,
  displayCategory = true,
  hasAccounts = true,
  manualTotalPaid = 0,
  manualTotalRemaining = 0,
  manualAccountsCount = 0,
  accountsCount,
  nextSchedule,
}: BorrowerScheduleCardProps) {
  const router = useRouter();
  const groups = groupSchedulesByDate(schedules);
  const nextGroups = nextSchedule ? groupSchedulesByDate([nextSchedule]) : [];

  const isManualAccount =
    manualAccountsCount > 0 &&
    (accountsCount ?? manualAccountsCount) === manualAccountsCount;

  const showRemaining =
    variant !== "paid" &&
    (totalRemaining > 0 || schedules.some((s) => s.status !== "paid"));

  return (
    <article
      className="dark:border-border dark:bg-card relative flex flex-col
        rounded-lg shadow-sm bg-white"
      onPointerEnter={() => {
        if (borrowerId) router.prefetch(`/borrowers/${borrowerId}`);
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-lg"
        style={{
          backgroundImage: `linear-gradient(135deg, ${categoryColor ?? "#cbd5e1"}15, transparent 50%)`,
        }}
      />
      <div
        className="flex flex-col gap-1 border-b border-slate-100 p-3
          dark:border-border/50"
      >
        <Link
          href={borrowerId ? `/borrowers/${borrowerId}` : "#"}
          prefetch
          className="dark:text-foreground block truncate text-xl tracking-tight
            font-bold text-slate-700 lowercase transition hover:opacity-70"
        >
          {name}
        </Link>
        {displayCategory && (
          <span
            className="dark:text-muted-foreground inline-flex items-center
              gap-1.5 text-[12px] font-bold text-slate-400 uppercase"
          >
            <span
              className="size-2 shrink-0 rounded-full border
                border-slate-900/25"
              style={{
                backgroundColor: categoryColor ?? "#cbd5e1",
              }}
              aria-hidden
            />
            {category}
          </span>
        )}
      </div>

      <div className="flex-1 p-3">
        {!hasAccounts ? (
          <p
            className="text-xs font-medium text-slate-400
              dark:text-muted-foreground"
          >
            no active account
          </p>
        ) : isManualAccount ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="text-[10px] font-semibold text-slate-400 uppercase
                    dark:text-muted-foreground"
                >
                  manual account
                </p>
                <p
                  className="text-sm font-bold text-slate-700
                    dark:text-foreground"
                >
                  PHP {manualTotalRemaining.toLocaleString()} remaining
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[8px]
                  font-black uppercase bg-sky-100 text-sky-700 dark:bg-sky-800
                  dark:text-sky-100`}
              >
                manual
              </span>
            </div>
            {manualTotalPaid > 0 && (
              <p
                className="text-[10px] font-semibold text-slate-400
                  dark:text-slate-500"
              >
                &#8369;{manualTotalPaid.toLocaleString()} paid
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {groups.length === 0 ? (
              <>
                <p
                  className="text-xs font-medium text-slate-400
                    dark:text-muted-foreground"
                >
                  there is no sched for this month
                </p>
                {nextGroups.map((g, i) => (
                  <ScheduleGroupItem
                    key={g.date + i}
                    g={g}
                    tz={tz}
                    label="next schedule"
                  />
                ))}
              </>
            ) : (
              groups.map((g, i) => (
                <ScheduleGroupItem key={g.date + i} g={g} tz={tz} />
              ))
            )}
          </div>
        )}
        {children}
      </div>

      {hasAccounts && (
        <div
          className="flex flex-col gap-1 rounded-b-lg border-t border-slate-100
            bg-slate-50/60 p-3 dark:border-border/50 dark:bg-muted/30"
        >
          {variant === "paid" ? (
            <div className="flex items-center justify-between">
              <span
                className="dark:text-muted-foreground text-[10px] font-bold
                  tracking-wide text-slate-400 uppercase"
              >
                total collected
              </span>
              <span
                className="dark:text-foreground text-sm font-black
                  text-slate-700"
              >
                PHP {totalPaid.toLocaleString()}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold tracking-wide text-slate-400
                    uppercase"
                >
                  total paid
                </span>
                <span
                  className="text-sm font-bold text-emerald-600
                    dark:text-emerald-400"
                >
                  ₱{totalPaid.toLocaleString()}
                </span>
              </div>
              {showRemaining && (
                <>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold tracking-wide
                        text-slate-400 uppercase"
                    >
                      total remaining
                    </span>
                    <span
                      className="text-sm font-bold text-slate-600
                        dark:text-slate-300"
                    >
                      ₱{totalRemaining.toLocaleString()}
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between border-t
                      border-slate-200 pt-1 dark:border-slate-700/40"
                  >
                    <span
                      className="text-[10px] font-bold tracking-wide
                        text-slate-500 uppercase"
                    >
                      total expected
                    </span>
                    <span
                      className="text-sm font-black text-slate-800
                        dark:text-slate-100"
                    >
                      ₱{totalExpected.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}
