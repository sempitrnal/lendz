"use client";

import { useQuery } from "@tanstack/react-query";
import { monthProfit, type AccountTerms } from "@/lib/checklist/profit";
import { supabase } from "@/lib/supabase/client";

export const MONTH_PROFIT_KEY = "checklist-month-profit";

/** "2026-10-21" -> its month's first day and the next month's first day. */
function monthRange(date: string): [string, string] {
  const [y, m] = date.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return [`${y}-${pad(m)}-01`, `${next[0]}-${pad(next[1])}-01`];
}

/**
 * Profit collected on the schedules due in `date`'s month (the dashboard's
 * month figure). Null until it loads, and while offline with nothing saved.
 */
export function useMonthProfit(date: string): number | null {
  const [from, to] = monthRange(date);
  const { data } = useQuery({
    queryKey: [MONTH_PROFIT_KEY, from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_schedules")
        .select(
          "amount_paid, accounts!inner(principal_amount, term_months, payment_frequency, term_installments, schedule_mode, deleted_at)",
        )
        .gte("due_date", from)
        .lt("due_date", to)
        .is("accounts.deleted_at", null)
        .range(0, 4999);
      if (error) throw new Error(error.message);
      return monthProfit(
        (data ?? []) as unknown as {
          amount_paid: number | null;
          accounts: AccountTerms | AccountTerms[] | null;
        }[],
      );
    },
    staleTime: 60_000,
  });
  return data ?? null;
}
