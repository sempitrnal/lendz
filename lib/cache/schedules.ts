import { createClient } from "@supabase/supabase-js";

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

export type ScheduleRow = {
  id: string;
  account_id: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  due_date: string;
  paid_date: string | null;
  status: string;
};

const PAGE_SIZE = 1000;

export async function getAllPaymentSchedules(): Promise<ScheduleRow[]> {
  const supabase = createSupabaseAdmin();
  const allRows: ScheduleRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, amount_due, amount_paid, remaining_amount, status, due_date, paid_date",
      )
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    allRows.push(...(data as ScheduleRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}
