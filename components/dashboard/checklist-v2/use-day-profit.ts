"use client";

import { useQuery } from "@tanstack/react-query";
import {
  dayProfit,
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
  payment_schedules: Embedded<{ accounts: Embedded<AccountTerms> }>;
};

/**
 * Profit collected on `date`: what the payments made that day add beyond each
 * schedule's principal share, whichever day the schedule was due. A partial
 * payment's profit lands on the day it was paid, not on later days. Null until
 * it loads, and while offline with nothing saved.
 */
export function useDayProfit(date: string): number | null {
  const { data } = useQuery({
    queryKey: [DAY_PROFIT_KEY, date],
    queryFn: async () => {
      const today = await supabase
        .from("schedule_payments")
        .select(
          "id, schedule_id, amount, created_at, payment_schedules!inner(accounts!inner(principal_amount, term_months, payment_frequency, term_installments, schedule_mode, deleted_at))",
        )
        .eq("payment_date", date)
        .is("payment_schedules.accounts.deleted_at", null)
        .range(0, 4999);
      if (today.error) throw new Error(today.error.message);
      const payments = (today.data ?? []) as unknown as DayPayment[];
      if (payments.length === 0) return 0;

      const ids = [...new Set(payments.map((p) => p.schedule_id))];
      const earlier = await supabase
        .from("schedule_payments")
        .select("schedule_id, amount")
        .in("schedule_id", ids)
        .lt("payment_date", date)
        .range(0, 9999);
      if (earlier.error) throw new Error(earlier.error.message);

      const before = new Map<string, number>();
      for (const p of earlier.data ?? []) {
        const id = String(p.schedule_id);
        before.set(id, (before.get(id) ?? 0) + Number(p.amount ?? 0));
      }
      const shares = new Map<string, number>();
      for (const p of payments) {
        const account = one(one(p.payment_schedules)?.accounts ?? null);
        if (account) shares.set(p.schedule_id, principalShare(account));
      }
      const ordered = [...payments].sort(
        (a, b) =>
          (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
          a.id.localeCompare(b.id),
      );
      return dayProfit(
        ordered.map((p) => ({
          scheduleId: p.schedule_id,
          amount: Number(p.amount ?? 0),
        })),
        before,
        shares,
      );
    },
    staleTime: 30_000,
  });
  return data ?? null;
}
