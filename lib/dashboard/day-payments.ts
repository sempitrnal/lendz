import type { SupabaseClient } from "@supabase/supabase-js";

import {
  principalShare,
  profitOnInstallment,
  type AccountTerms,
} from "@/lib/checklist/profit";
import type { PaymentCategory } from "@/lib/dashboard/daily-profit";

type Embedded<T> = T | T[] | null;
const one = <T>(value: Embedded<T>): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

type DayPaymentRow = {
  id: string;
  schedule_id: string;
  amount: number | null;
  payment_date: string;
  created_at: string | null;
  payment_schedules: Embedded<{
    due_date: string | null;
    accounts: Embedded<
      AccountTerms & {
        id: string;
        borrowers: Embedded<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          borrower_categories: Array<{
            category: Embedded<{ name: string; color: string | null }>;
          }> | null;
        }>;
      }
    >;
  }>;
};

/** One payment received on a day, with who paid and the profit in it. */
export type DayPayment = {
  id: string;
  borrowerId: string | null;
  accountId: string | null;
  name: string | null;
  categories: PaymentCategory[];
  amount: number;
  /** The part of it beyond the installment's share of the principal. */
  profit: number;
  /** yyyy-mm-dd the installment was due, when known. */
  dueDate: string | null;
};

const ID_BATCH = 100;

const nextDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * Every payment received on `date` ("2026-11-12"), newest first, with the
 * profit each added. A payment earns profit for the part that lifts its
 * installment past its principal share, counting what was paid on it before
 * (earlier days, and earlier payments that day), as the profit calendar does.
 */
export async function loadDayPayments(
  client: SupabaseClient,
  date: string,
): Promise<DayPayment[]> {
  const page = await client
    .from("schedule_payments")
    .select(
      "id, schedule_id, amount, payment_date, created_at, payment_schedules!inner(due_date, accounts!inner(id, principal_amount, term_months, payment_frequency, term_installments, schedule_mode, deleted_at, borrowers(id, first_name, last_name, borrower_categories(category:categories(name, color)))))",
    )
    .gte("payment_date", date)
    .lt("payment_date", nextDay(date))
    .is("payment_schedules.accounts.deleted_at", null)
    .order("created_at")
    .order("id")
    .range(0, 1999);
  if (page.error) throw new Error(page.error.message);
  const rows = (page.data ?? []) as unknown as DayPaymentRow[];
  if (rows.length === 0) return [];

  // What each of those installments had been paid before this day.
  const ids = [...new Set(rows.map((r) => r.schedule_id))];
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
        .lt("payment_date", date)
        .range(0, 9999),
    ),
  );
  const paid = new Map<string, number>();
  for (const result of earlier) {
    if (result.error) throw new Error(result.error.message);
    for (const p of result.data ?? []) {
      const id = String(p.schedule_id);
      paid.set(id, (paid.get(id) ?? 0) + Number(p.amount ?? 0));
    }
  }

  const out: DayPayment[] = [];
  for (const r of rows) {
    const schedule = one(r.payment_schedules);
    const account = one(schedule?.accounts ?? null);
    const borrower = one(account?.borrowers ?? null);
    const amount = Number(r.amount ?? 0);
    const prior = paid.get(r.schedule_id) ?? 0;
    paid.set(r.schedule_id, prior + amount);
    const share = account ? principalShare(account) : null;
    const profit =
      share === null
        ? 0
        : profitOnInstallment(prior + amount, share) -
          profitOnInstallment(prior, share);
    out.push({
      id: r.id,
      borrowerId: borrower?.id ?? null,
      accountId: account?.id ?? null,
      name: borrower
        ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") ||
          null
        : null,
      categories: (borrower?.borrower_categories ?? []).flatMap((row) => {
        const category = one(row.category);
        return category ? [{ name: category.name, color: category.color }] : [];
      }),
      amount,
      profit: Math.round(profit * 100) / 100,
      dueDate: schedule?.due_date ?? null,
    });
  }
  return out.reverse();
}
