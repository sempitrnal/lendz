"use client";

import { useQuery } from "@tanstack/react-query";
import {
  dayPaymentsProfit,
  principalShare,
  type AccountTerms,
} from "@/lib/checklist/profit";
import { supabase } from "@/lib/supabase/client";

export const DAY_PROFIT_KEY = "checklist-day-profit";

type Embedded<T> = T | T[] | null;
const one = <T>(value: Embedded<T>): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

type DayPayment = {
  id: string;
  schedule_id: string;
  amount: number | null;
  created_at: string | null;
  payment_schedules: Embedded<{
    amount_due: number | null;
    accounts: Embedded<AccountTerms>;
  }>;
};

/**
 * Profit collected on `date`: only the payments made that day, each carrying
 * its installment's share of profit in proportion to the amount paid,
 * whichever day the schedule was due. A partial payment's profit lands on the
 * day it was paid, not on later days. Null until
 * it loads, and while offline with nothing saved.
 */
export function useDayProfit(date: string): number | null {
  const { data } = useQuery({
    queryKey: [DAY_PROFIT_KEY, date],
    queryFn: async () => {
      const today = await supabase
        .from("schedule_payments")
        .select(
          "id, schedule_id, amount, created_at, payment_schedules!inner(amount_due, accounts!inner(principal_amount, term_months, payment_frequency, term_installments, schedule_mode, deleted_at))",
        )
        .eq("payment_date", date)
        .is("payment_schedules.accounts.deleted_at", null)
        .range(0, 4999);
      if (today.error) throw new Error(today.error.message);
      const payments = (today.data ?? []) as unknown as DayPayment[];
      if (payments.length === 0) return 0;

      // Only the payments made that day count, each in proportion to what
      // its installment earns: earlier payments don't change it.
      const terms = new Map<string, { due: number; share: number }>();
      for (const p of payments) {
        const schedule = one(p.payment_schedules);
        const account = one(schedule?.accounts ?? null);
        if (account) {
          terms.set(p.schedule_id, {
            due: Number(schedule?.amount_due ?? 0),
            share: principalShare(account),
          });
        }
      }
      return dayPaymentsProfit(
        payments.map((p) => ({
          scheduleId: p.schedule_id,
          amount: Number(p.amount ?? 0),
        })),
        terms,
      );
    },
    staleTime: 30_000,
  });
  return data ?? null;
}
