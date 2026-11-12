import type { SupabaseClient } from "@supabase/supabase-js";

import { principalShare, type AccountTerms } from "@/lib/checklist/profit";
import {
  dailyProfit,
  monthBounds,
  type CalendarPayment,
  type DayFigure,
} from "@/lib/dashboard/daily-profit";

type Embedded<T> = T | T[] | null;
const one = <T>(value: Embedded<T>): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

type BorrowerName = {
  first_name: string | null;
  last_name: string | null;
  borrower_categories: Array<{
    category: Embedded<{ name: string; color: string | null }>;
  }> | null;
};

type PaymentRow = {
  id: string;
  schedule_id: string;
  amount: number | null;
  payment_date: string;
  created_at: string | null;
  payment_schedules: Embedded<{
    due_date: string | null;
    accounts: Embedded<
      AccountTerms & { borrowers: Embedded<BorrowerName> }
    >;
  }>;
};

/** Ids per request: a long period's schedules don't fit in one address. */
const ID_BATCH = 100;
/** Rows per page when reading payments. */
const PAGE = 1000;

const borrowerName = (b: BorrowerName | null) =>
  b ? [b.first_name, b.last_name].filter(Boolean).join(" ") || null : null;

const borrowerCategories = (b: BorrowerName | null) =>
  (b?.borrower_categories ?? []).flatMap((row) => {
    const category = one(row.category);
    return category ? [{ name: category.name, color: category.color }] : [];
  });

/**
 * What was collected, and the profit in it, on each day from the first of
 * `fromMonth` to the end of `toMonth` ("2026-11"), counted on the day it was
 * paid, whichever month the installment was due. This is the profit
 * calendar's own figure; summing it by month gives the dashboard's.
 */
export async function loadDayFigures(
  client: SupabaseClient,
  fromMonth: string,
  toMonth: string,
): Promise<Record<string, DayFigure>> {
  const from = monthBounds(fromMonth)[0];
  const to = monthBounds(toMonth)[1];

  const rows: PaymentRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await client
      .from("schedule_payments")
      .select(
        "id, schedule_id, amount, payment_date, created_at, payment_schedules!inner(due_date, accounts!inner(principal_amount, term_months, payment_frequency, term_installments, schedule_mode, deleted_at, borrowers(first_name, last_name, borrower_categories(category:categories(name, color)))))",
      )
      .gte("payment_date", from)
      .lt("payment_date", to)
      .is("payment_schedules.accounts.deleted_at", null)
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (page.error) throw new Error(page.error.message);
    const batch = (page.data ?? []) as unknown as PaymentRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  if (rows.length === 0) return {};

  // What each of those schedules had been paid before the period began.
  const ids = [...new Set(rows.map((r) => r.schedule_id))];
  const before = new Map<string, number>();
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    batches.push(ids.slice(i, i + ID_BATCH));
  }
  const earlier = await Promise.all(
    batches.map((batch) =>
      client
        .from("schedule_payments")
        .select("schedule_id, amount")
        .in("schedule_id", batch)
        .lt("payment_date", from)
        .range(0, 9999),
    ),
  );
  for (const result of earlier) {
    if (result.error) throw new Error(result.error.message);
    for (const p of result.data ?? []) {
      const id = String(p.schedule_id);
      before.set(id, (before.get(id) ?? 0) + Number(p.amount ?? 0));
    }
  }

  const shares = new Map<string, number>();
  const payments: CalendarPayment[] = [];
  for (const r of rows) {
    const account = one(one(r.payment_schedules)?.accounts ?? null);
    if (account) shares.set(r.schedule_id, principalShare(account));
    payments.push({
      id: r.id,
      scheduleId: r.schedule_id,
      date: r.payment_date.slice(0, 10),
      amount: Number(r.amount ?? 0),
      createdAt: r.created_at,
      dueDate: one(r.payment_schedules)?.due_date ?? null,
      name: borrowerName(one(account?.borrowers ?? null)),
      categories: borrowerCategories(one(account?.borrowers ?? null)),
    });
  }
  return dailyProfit(payments, before, shares);
}

/** The days' collected amount, profit and not-due profit added up per month ("2026-11"). */
export function totalsByMonth(
  days: Record<string, DayFigure>,
): Map<string, { collected: number; profit: number; otherMonths: number }> {
  const out = new Map<string, { collected: number; profit: number; otherMonths: number }>();
  for (const [date, figure] of Object.entries(days)) {
    const key = date.slice(0, 7);
    const cur = out.get(key) ?? { collected: 0, profit: 0, otherMonths: 0 };
    cur.collected += figure.collected;
    cur.profit += figure.profit;
    cur.otherMonths += figure.otherMonths;
    out.set(key, cur);
  }
  return out;
}
