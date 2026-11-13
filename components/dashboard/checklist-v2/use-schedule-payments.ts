"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { DAY_PROFIT_KEY } from "@/components/dashboard/checklist-v2/use-day-profit";

export type SchedulePayment = {
  /** The payment's own id, to undo just this one. */
  id?: string;
  amount: number;
  /** `YYYY-MM-DD`; null when the payment was saved without a date. */
  payment_date: string | null;
};

/**
 * Each schedule's payments, oldest first: the history an expanded checklist
 * row shows. Only fetched while `enabled` (the row is open). Its key sits
 * under the day-profit key, so recording a payment refreshes it too.
 */
export function useSchedulePayments(
  scheduleIds: string[],
  enabled: boolean,
): Record<string, SchedulePayment[]> | undefined {
  const ids = [...new Set(scheduleIds)].sort();
  const { data } = useQuery({
    queryKey: [DAY_PROFIT_KEY, "schedule-payments", "with-ids", ids],
    enabled: enabled && ids.length > 0,
    queryFn: async () => {
      const res = await supabase
        .from("schedule_payments")
        .select("id, schedule_id, amount, payment_date")
        .in("schedule_id", ids)
        .order("payment_date", { ascending: true, nullsFirst: true })
        .range(0, 4999);
      if (res.error) throw new Error(res.error.message);
      const by: Record<string, SchedulePayment[]> = {};
      for (const p of (res.data ?? []) as {
        id: string;
        schedule_id: string;
        amount: number | string | null;
        payment_date: string | null;
      }[]) {
        (by[String(p.schedule_id)] ??= []).push({
          id: String(p.id),
          amount: Number(p.amount ?? 0),
          payment_date: p.payment_date
            ? String(p.payment_date).slice(0, 10)
            : null,
        });
      }
      return by;
    },
    staleTime: 30_000,
  });
  return data;
}
