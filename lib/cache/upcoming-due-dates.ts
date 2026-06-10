import { createClient } from "@supabase/supabase-js";
import {
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

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

type ScheduleRow = {
  id: string;
  account_id: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  due_date: string;
  status: string;
};

type AccountRow = {
  id: string;
  borrower_id: string;
  principal_amount: number | null;
};

type BorrowerRow = {
  id: string;
  first_name: string;
  last_name: string;
};

const PAGE_SIZE = 1000;

async function fetchUnpaidSchedulesUpTo(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  todayPlus14: string,
): Promise<ScheduleRow[]> {
  const allRows: ScheduleRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, amount_due, amount_paid, remaining_amount, status, due_date",
      )
      .in("status", ["pending", "partial"])
      .lte("due_date", todayPlus14)
      .order("due_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    allRows.push(...(data as ScheduleRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

export type UpcomingEntry = {
  scheduleId: string;
  accountId: string;
  borrowerId: string | null;
  borrowerName: string;
  dueDate: string;
  daysUntilDue: number;
  amountDue: number;
  remaining: number;
  scheduleStatus: string;
};

export type UpcomingDueDatesData = {
  overdue: UpcomingEntry[];
  withinSevenDays: UpcomingEntry[];
  withinFourteenDays: UpcomingEntry[];
};

export async function getUpcomingDueDatesData(
  todayIso: string,
): Promise<UpcomingDueDatesData> {
  const supabase = createSupabaseAdmin();

  const todayParts = todayIso.split("-").map(Number);
  const todayDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const plus14Date = new Date(todayDate);
  plus14Date.setDate(plus14Date.getDate() + 14);
  const todayPlus14 = [
    plus14Date.getFullYear(),
    String(plus14Date.getMonth() + 1).padStart(2, "0"),
    String(plus14Date.getDate()).padStart(2, "0"),
  ].join("-");

  const schedules = await fetchUnpaidSchedulesUpTo(supabase, todayPlus14);

  // Group by account, pick earliest pending/partial per account
  const byAccount = new Map<string, ScheduleRow[]>();
  for (const row of schedules) {
    const list = byAccount.get(row.account_id) ?? [];
    list.push(row);
    byAccount.set(row.account_id, list);
  }

  // nextDueScheduleForCollection already picks the earliest pending/partial
  const nextPerAccount: ScheduleRow[] = [];
  for (const list of byAccount.values()) {
    list.sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
    );
    const next = nextDueScheduleForCollection(list);
    if (next && remainingOnInstallment(next) > 0) {
      nextPerAccount.push(next);
    }
  }

  // Fetch accounts and borrowers for these entries
  const accountIds = [...new Set(nextPerAccount.map((s) => s.account_id))];
  const accountsById = new Map<string, AccountRow>();
  const borrowersById = new Map<string, BorrowerRow>();

  if (accountIds.length > 0) {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, borrower_id, principal_amount")
      .in("id", accountIds)
      .is("deleted_at", null);

    for (const a of (accountsData ?? []) as AccountRow[]) {
      accountsById.set(a.id, a);
    }

    const borrowerIds = [
      ...new Set(
        (accountsData ?? []).map(
          (a: unknown) => (a as AccountRow).borrower_id,
        ),
      ),
    ].filter(Boolean) as string[];

    if (borrowerIds.length > 0) {
      const { data: borrowersData } = await supabase
        .from("borrowers")
        .select("id, first_name, last_name")
        .in("id", borrowerIds)
        .is("deleted_at", null);

      for (const b of (borrowersData ?? []) as BorrowerRow[]) {
        borrowersById.set(b.id, b);
      }
    }
  }

  function daysFromToday(dueDateIso: string): number {
    const [y, m, d] = dueDateIso.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    const diff = due.getTime() - todayDate.getTime();
    return Math.round(diff / 86400000);
  }

  const overdue: UpcomingEntry[] = [];
  const withinSevenDays: UpcomingEntry[] = [];
  const withinFourteenDays: UpcomingEntry[] = [];

  // Sort all next-per-account by due date ascending
  nextPerAccount.sort(
    (a, b) =>
      a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
  );

  for (const schedule of nextPerAccount) {
    const account = accountsById.get(schedule.account_id);
    if (!account) continue;
    const borrower = borrowersById.get(account.borrower_id);
    const days = daysFromToday(schedule.due_date);

    const entry: UpcomingEntry = {
      scheduleId: schedule.id,
      accountId: schedule.account_id,
      borrowerId: borrower?.id ?? null,
      borrowerName: borrower
        ? `${borrower.first_name} ${borrower.last_name}`
        : "Unknown borrower",
      dueDate: schedule.due_date,
      daysUntilDue: days,
      amountDue: Number(schedule.amount_due ?? 0),
      remaining: remainingOnInstallment(schedule),
      scheduleStatus: schedule.status,
    };

    if (days < 0) {
      overdue.push(entry);
    } else if (days <= 7) {
      withinSevenDays.push(entry);
    } else {
      withinFourteenDays.push(entry);
    }
  }

  return { overdue, withinSevenDays, withinFourteenDays };
}
