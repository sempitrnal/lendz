import { createClient } from "@supabase/supabase-js";
import { isInstallmentFullyPaid } from "@/lib/payment-schedule/schedule-balances";

function createSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
}

const PAYMENT_SCHEDULE_PAGE_SIZE = 1000;
const ACCOUNT_ID_IN_CHUNK = 120;

type AccountListItem = {
  id: string;
  borrower_id: string;
  type: string;
  status: string;
  principal_amount: number | null;
  interest_rate: number | null;
  payment_frequency: string | null;
  release_date: string | null;
  borrower: {
    id: string;
    first_name: string;
    last_name: string;
    borrower_categories: {
      category: {
        id: string;
        name: string;
        color: string | null;
      };
    }[];
  } | null;
};

type PaymentProgress = {
  paid: number;
  total: number;
  pct: number;
};

export type AccountPageMetrics = {
  total_paid: number;
  total_remaining: number;
  next_due: string | null;
  next_amount: number;
  next_status: "pending" | "overdue" | null;
  overdue_count: number;
};

export type AccountsPageData = {
  rows: (AccountListItem & {
    payment_progress: PaymentProgress;
    metrics: AccountPageMetrics;
  })[];
};

export async function getAccountsPageData(): Promise<AccountsPageData> {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("accounts")
    .select(
      `
      id,
      borrower_id,
      type,
      status,
      principal_amount,
      interest_rate,
      payment_frequency,
      release_date,
      borrower:borrowers (
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
      )
    `,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  const baseRows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const br = Array.isArray(r.borrower)
      ? (r.borrower[0] as Record<string, unknown>)
      : (r.borrower as Record<string, unknown> | undefined);
    const rawCats = br?.borrower_categories;
    const catList = Array.isArray(rawCats) ? rawCats : rawCats ? [rawCats] : [];
    const borrower_categories = catList
      .map((bc) => {
        const catRow = typeof bc === "object" && bc !== null ? bc : null;
        if (!catRow) return null;
        const categoryValue = (catRow as Record<string, unknown>).category;
        const cat = Array.isArray(categoryValue)
          ? categoryValue[0]
          : categoryValue;
        if (!cat || typeof cat !== "object") return null;
        return {
          category: {
            id: String((cat as Record<string, unknown>).id ?? ""),
            name: String((cat as Record<string, unknown>).name ?? ""),
            color:
              ((cat as Record<string, unknown>).color as string | null) ?? null,
          },
        };
      })
      .filter(<T>(x: T | null): x is T => x !== null) as NonNullable<
      AccountListItem["borrower"]
    >["borrower_categories"];

    return {
      ...r,
      borrower: br
        ? {
            id: String(br.id ?? ""),
            first_name: String(br.first_name ?? ""),
            last_name: String(br.last_name ?? ""),
            borrower_categories,
          }
        : null,
    };
  }) as Omit<AccountListItem, "payment_progress">[];

  const accountIds = baseRows.map((r) => r.id);
  const progressById: Record<string, PaymentProgress> = {};
  const metricsById: Record<string, AccountPageMetrics> = {};

  if (accountIds.length > 0) {
    const all: {
      account_id: string;
      status: string;
      amount_due: number | null;
      amount_paid: number | null;
      remaining_amount: number | null;
      due_date: string;
    }[] = [];

    for (let c = 0; c < accountIds.length; c += ACCOUNT_ID_IN_CHUNK) {
      const chunk = accountIds.slice(c, c + ACCOUNT_ID_IN_CHUNK);
      let from = 0;
      for (;;) {
        const { data: schedData, error: schedError } = await supabase
          .from("payment_schedules")
          .select(
            "account_id, status, amount_due, amount_paid, remaining_amount, due_date",
          )
          .in("account_id", chunk)
          .range(from, from + PAYMENT_SCHEDULE_PAGE_SIZE - 1);

        if (schedError) {
          console.error(schedError);
          break;
        }
        const rows = (schedData ?? []) as {
          account_id: string;
          status: string;
          amount_due: number | null;
          amount_paid: number | null;
          remaining_amount: number | null;
          due_date: string;
        }[];
        all.push(...rows);
        if (rows.length < PAYMENT_SCHEDULE_PAGE_SIZE) break;
        from += PAYMENT_SCHEDULE_PAGE_SIZE;
      }
    }

    const byAccount = new Map<
      string,
      {
        total: number;
        paid: number;
        totalPaid: number;
        totalRemaining: number;
        overdueCount: number;
        nextDue: { due_date: string; remaining: number; status: string } | null;
      }
    >();
    for (const s of all) {
      const remaining = Math.max(
        0,
        Number(
          s.remaining_amount ?? (s.amount_due ?? 0) - (s.amount_paid ?? 0),
        ),
      );
      const paid = Number(s.amount_paid ?? 0);
      const cur = byAccount.get(s.account_id) ?? {
        total: 0,
        paid: 0,
        totalPaid: 0,
        totalRemaining: 0,
        overdueCount: 0,
        nextDue: null,
      };
      cur.total += 1;
      cur.totalPaid += paid;
      cur.totalRemaining += remaining;
      if (isInstallmentFullyPaid(s)) cur.paid += 1;
      if (s.status === "overdue") cur.overdueCount += 1;
      if (s.status === "pending" || s.status === "overdue") {
        if (
          !cur.nextDue ||
          (s.due_date && s.due_date.localeCompare(cur.nextDue.due_date) < 0)
        ) {
          cur.nextDue = {
            due_date: s.due_date,
            remaining,
            status: s.status,
          };
        }
      }
      byAccount.set(s.account_id, cur);
    }

    for (const [accountId, stats] of byAccount) {
      progressById[accountId] = {
        paid: stats.paid,
        total: stats.total,
        pct: stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0,
      };
      metricsById[accountId] = {
        total_paid: stats.totalPaid,
        total_remaining: stats.totalRemaining,
        next_due: stats.nextDue?.due_date ?? null,
        next_amount: stats.nextDue?.remaining ?? 0,
        next_status: (stats.nextDue?.status as "pending" | "overdue") ?? null,
        overdue_count: stats.overdueCount,
      };
    }
  }

  const rows = baseRows.map((r) => ({
    ...r,
    payment_progress: progressById[r.id] ?? { paid: 0, total: 0, pct: 0 },
    metrics: metricsById[r.id] ?? {
      total_paid: 0,
      total_remaining: 0,
      next_due: null,
      next_amount: 0,
      next_status: null,
      overdue_count: 0,
    },
  }));

  return { rows };
}
