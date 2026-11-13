"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { DAY_PROFIT_KEY } from "@/components/dashboard/checklist-v2/use-day-profit";
import type { DayPayment } from "@/lib/checklist/day-summary";

type PaymentRow = {
  schedule_id: string;
  payment_schedules:
    | { due_date: string | null }
    | { due_date: string | null }[]
    | null;
};

/**
 * The payments made on `date`, each with its schedule's due date. Null until
 * it loads (and offline with nothing saved). Its key sits under the
 * day-profit key, so recording a payment refreshes it with the day's profit.
 */
export function useDayPayments(date: string): readonly DayPayment[] | null {
  const { data } = useQuery({
    queryKey: [DAY_PROFIT_KEY, "day-payments", date],
    queryFn: async (): Promise<DayPayment[]> => {
      const res = await supabase
        .from("schedule_payments")
        .select("schedule_id, payment_schedules(due_date)")
        .eq("payment_date", date)
        .range(0, 4999);
      if (res.error) throw new Error(res.error.message);
      return ((res.data ?? []) as unknown as PaymentRow[]).map((p) => {
        const schedule = Array.isArray(p.payment_schedules)
          ? p.payment_schedules[0]
          : p.payment_schedules;
        return {
          scheduleId: String(p.schedule_id),
          dueDate: schedule?.due_date ?? null,
        };
      });
    },
    staleTime: 30_000,
  });
  return data ?? null;
}

/**
 * The schedules a payment was made to on `date`, so a part payment shows only
 * on the day it was paid. Null until it loads (and offline with nothing saved).
 */
export function useDayPaidIds(date: string): ReadonlySet<string> | null {
  const payments = useDayPayments(date);
  return useMemo(
    () => (payments ? new Set(payments.map((p) => p.scheduleId)) : null),
    [payments],
  );
}
