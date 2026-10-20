import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

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
  calculate_skipped_schedules: boolean | null;
  created_at: string;
};

type BorrowerCategoryRow = {
  id: string;
  name: string;
  color: string | null;
};

type BorrowerRow = {
  id: string;
  first_name: string;
  last_name: string;
  borrower_categories?: { category: BorrowerCategoryRow }[];
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
  paymentsMap: Record<string, SchedulePaymentRow[]>;
};

async function fetchAccountDetailPageData(
  id: string,
): Promise<AccountDetailData> {
  const supabase = createSupabaseAdmin();

  // Schedules only need the account id, so they load alongside the account,
  // with each schedule's payments embedded instead of a separate query.
  const [accountRes, schedulesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "id, borrower_id, type, status, release_date, principal_amount, interest_rate, term_months, payment_frequency, schedule_mode, interest_type, first_payment_date, calculate_skipped_schedules, created_at",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, note, paid_date, status, schedule_payments(id, schedule_id, amount, payment_date, note, created_at)",
      )
      .eq("account_id", id)
      .order("due_date", { ascending: true })
      .order("created_at", {
        referencedTable: "schedule_payments",
        ascending: true,
      }),
  ]);

  const account = accountRes.data;
  if (accountRes.error || !account) {
    throw new Error("Account not found");
  }
  if (schedulesRes.error) {
    throw new Error(schedulesRes.error.message);
  }

  const { data: borrower } = await supabase
    .from("borrowers")
    .select(
      "id, first_name, last_name, borrower_categories(category:categories(id, name, color))",
    )
    .eq("id", account.borrower_id)
    .is("deleted_at", null)
    .single();

  const paymentsMap: Record<string, SchedulePaymentRow[]> = {};
  const schedules: PaymentScheduleRow[] = [];
  for (const row of schedulesRes.data ?? []) {
    const { schedule_payments, ...schedule } = row as PaymentScheduleRow & {
      schedule_payments: SchedulePaymentRow[] | null;
    };
    schedules.push(schedule);
    if (schedule_payments?.length) paymentsMap[schedule.id] = schedule_payments;
  }

  return {
    account: account as AccountRow,
    borrower: borrower as BorrowerRow | null,
    schedules,
    paymentsMap,
  };
}

/**
 * Tagged per account as well, so a payment on one account expires only that
 * account's page (`account-<id>`, which the schedule actions and the overdue
 * cron already target), while `account-detail` still expires them all.
 */
export function getAccountDetailPageData(id: string) {
  return unstable_cache(fetchAccountDetailPageData, ["account-detail"], {
    revalidate: 60,
    tags: ["account-detail", `account-${id}`],
  })(id);
}
