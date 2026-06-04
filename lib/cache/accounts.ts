import { createClient } from "@supabase/supabase-js";
import { cacheTag } from "next/cache";

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

type AccountRow = {
  id: string;
  borrower_id: string;
  type: string;
  status: string;
  release_date: string | null;
  principal_amount: number | null;
  interest_rate: number | null;
  term_months: number | null;
  payment_frequency: string | null;
  schedule_mode: string | null;
  interest_type: string | null;
  first_payment_date: string | null;
  created_at: string;
};

type BorrowerRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type PaymentScheduleRow = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  note: string | null;
  paid_date: string | null;
  status: string;
};

type SchedulePaymentRow = {
  id: string;
  schedule_id: string;
  amount: number;
  payment_date: string | null;
  note: string | null;
  created_at: string;
};

export type AccountDetailData = {
  account: AccountRow;
  borrower: BorrowerRow | null;
  schedules: PaymentScheduleRow[];
  paymentsMap: Map<string, SchedulePaymentRow[]>;
};

export async function getAccountDetailPageData(
  id: string,
): Promise<AccountDetailData> {
  "use cache";
  cacheTag("account");
  cacheTag(`account-${id}`);

  const supabase = createSupabaseAdmin();

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select(
      "id, borrower_id, type, status, release_date, principal_amount, interest_rate, term_months, payment_frequency, schedule_mode, interest_type, first_payment_date, created_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (accountError || !account) {
    throw new Error("Account not found");
  }

  const { data: borrower } = await supabase
    .from("borrowers")
    .select("id, first_name, last_name")
    .eq("id", account.borrower_id)
    .single();

  let schedulesData: unknown[] | null = null;
  {
    const res = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, note, paid_date, status",
      )
      .eq("account_id", account.id)
      .order("due_date", { ascending: true });
    if (res.error) {
      const fb1 = await supabase
        .from("payment_schedules")
        .select(
          "id, account_id, due_date, amount_due, amount_paid, remaining_amount, note, status",
        )
        .eq("account_id", account.id)
        .order("due_date", { ascending: true });
      if (fb1.error) {
        const fb2 = await supabase
          .from("payment_schedules")
          .select("id, account_id, due_date, amount_due, status")
          .eq("account_id", account.id)
          .order("due_date", { ascending: true });
        schedulesData = (fb2.data ?? []) as unknown[];
      } else {
        schedulesData = fb1.data ?? [];
      }
    } else {
      schedulesData = res.data ?? [];
    }
  }

  const scheduleIds = ((schedulesData ?? []) as { id: string }[]).map(
    (s) => s.id,
  );
  const paymentsMap = new Map<string, SchedulePaymentRow[]>();
  if (scheduleIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from("schedule_payments")
      .select("id, schedule_id, amount, payment_date, note, created_at")
      .in("schedule_id", scheduleIds)
      .order("created_at", { ascending: true });
    for (const p of (paymentsData ?? []) as SchedulePaymentRow[]) {
      const list = paymentsMap.get(p.schedule_id) ?? [];
      list.push(p);
      paymentsMap.set(p.schedule_id, list);
    }
  }

  return {
    account: account as AccountRow,
    borrower: borrower as BorrowerRow | null,
    schedules: (schedulesData ?? []) as PaymentScheduleRow[],
    paymentsMap,
  };
}
