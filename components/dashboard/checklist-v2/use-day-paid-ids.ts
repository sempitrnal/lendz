"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { DAY_PROFIT_KEY } from "@/components/dashboard/checklist-v2/use-day-profit";

/**
 * The schedules a payment was made to on `date`, so a part payment shows only
 * on the day it was paid. Null until it loads (and offline with nothing saved).
 * Its key sits under the day-profit key, so recording a payment refreshes both.
 */
export function useDayPaidIds(date: string): ReadonlySet<string> | null {
  const { data } = useQuery({
    queryKey: [DAY_PROFIT_KEY, "paid-ids", date],
    queryFn: async () => {
      const res = await supabase
        .from("schedule_payments")
        .select("schedule_id")
        .eq("payment_date", date)
        .range(0, 4999);
      if (res.error) throw new Error(res.error.message);
      const rows = (res.data ?? []) as { schedule_id: string }[];
      return new Set(rows.map((p) => String(p.schedule_id)));
    },
    staleTime: 30_000,
  });
  return data ?? null;
}
