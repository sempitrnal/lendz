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

export type CalendarEventRow = {
  id: string;
  borrower_id: string;
  account_id: string | null;
  event_date: string;
  title: string | null;
  note: string | null;
  amount: number;
  status: string;
  created_at: string;
  borrower: {
    first_name: string;
    last_name: string;
    borrower_categories?: {
      category: {
        id: string;
        name: string;
        color: string;
      };
    }[];
  } | null;
  account: {
    principal_amount: number | null;
    status: string;
  } | null;
};

export async function getCalendarEvents(year: number, month: number) {
  const supabase = createSupabaseAdmin();

  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      `
      id,
      borrower_id,
      account_id,
      event_date,
      title,
      note,
      amount,
      status,
      created_at,
      borrower:borrowers(first_name, last_name, borrower_categories(category:categories(id, name, color))),
      account:accounts(principal_amount, status)
    `,
    )
    .gte("event_date", startOfMonth)
    .lte("event_date", endOfMonth)
    .order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as CalendarEventRow[];
}

export async function getCalendarEventsByBorrower(borrowerId: string) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      `
      id,
      borrower_id,
      account_id,
      event_date,
      title,
      note,
      amount,
      status,
      created_at,
      borrower:borrowers(first_name, last_name, borrower_categories(category:categories(id, name, color))),
      account:accounts(principal_amount, status)
    `,
    )
    .eq("borrower_id", borrowerId)
    .order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as CalendarEventRow[];
}
