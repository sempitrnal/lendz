import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { DueChecklistGroup } from "@/lib/checklist/types";
import { remainingOnInstallment } from "@/lib/payment-schedule/schedule-balances";

type Supabase = Awaited<ReturnType<typeof createSupabaseServer>>;

type DueScheduleRow = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  status: string;
};
type DueAccount = {
  id: string;
  borrower_id: string;
  type: "loan" | "cash_advance";
  schedule_mode: string | null;
};
type DueBorrower = { id: string; first_name: string; last_name: string };

const SCHEDULE_COLUMNS =
  "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status";

const one = <T>(value: T | T[] | null | undefined): T | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * Unpaid schedules due in the window that belong to a live, non-manual loan or
 * cash advance of a live borrower. One request: the account and borrower ride
 * along with each schedule and the filtering happens in the database.
 */
async function loadDueRows(
  supabase: Supabase,
  startDate: string,
  date: string,
) {
  const { data, error } = await supabase
    .from("payment_schedules")
    .select(
      `${SCHEDULE_COLUMNS}, accounts!inner(id, borrower_id, type, schedule_mode, borrowers!inner(id, first_name, last_name))`,
    )
    .gte("due_date", startDate)
    .lte("due_date", date)
    .neq("status", "paid")
    .in("accounts.type", ["loan", "cash_advance"])
    .is("accounts.deleted_at", null)
    .is("accounts.borrowers.deleted_at", null);

  if (!error) {
    return (data ?? []).flatMap((raw) => {
      const { accounts, ...row } = raw as unknown as DueScheduleRow & {
        accounts:
          | (DueAccount & { borrowers: DueBorrower | DueBorrower[] })
          | null;
      };
      const account = one(accounts);
      const borrower = one(account?.borrowers);
      if (!account || !borrower || account.schedule_mode === "manual") {
        return [];
      }
      return [{ row, account, borrower }];
    });
  }

  // The embed was rejected; read the three tables side by side instead.
  console.warn("due collections embed failed, falling back:", error.message);
  const [accountsRes, schedulesRes, borrowersRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, borrower_id, type, schedule_mode")
      .in("type", ["loan", "cash_advance"])
      .is("deleted_at", null),
    supabase
      .from("payment_schedules")
      .select(SCHEDULE_COLUMNS)
      .gte("due_date", startDate)
      .lte("due_date", date)
      .neq("status", "paid"),
    supabase
      .from("borrowers")
      .select("id, first_name, last_name")
      .is("deleted_at", null),
  ]);
  for (const res of [accountsRes, schedulesRes, borrowersRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  const accounts = new Map(
    ((accountsRes.data ?? []) as DueAccount[])
      .filter((a) => a.schedule_mode !== "manual")
      .map((a) => [a.id, a]),
  );
  const borrowers = new Map(
    ((borrowersRes.data ?? []) as DueBorrower[]).map((b) => [b.id, b]),
  );
  return ((schedulesRes.data ?? []) as DueScheduleRow[]).flatMap((row) => {
    const account = accounts.get(String(row.account_id));
    const borrower = account && borrowers.get(String(account.borrower_id));
    return account && borrower ? [{ row, account, borrower }] : [];
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Also carry over unpaid schedules due up to `back` days before `date`
  // (capped at 7).
  const back = Math.min(7, Math.max(0, Number(params.get("back")) || 0));
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - back);
  const startDate = start.toISOString().slice(0, 10);

  try {
    const supabase = await createSupabaseServer();
    const dueRows = await loadDueRows(supabase, startDate, date);

    const groups = new Map<string, DueChecklistGroup>();
    for (const { row, account, borrower } of dueRows) {
      const amount = remainingOnInstallment({
        amount_due: row.amount_due as number | null,
        amount_paid: row.amount_paid as number | null,
        remaining_amount: row.remaining_amount as number | null,
        status: String(row.status),
      });
      if (amount <= 0) continue;

      const group = groups.get(borrower.id) ?? {
        borrower_id: borrower.id,
        name: `${borrower.first_name} ${borrower.last_name}`.trim(),
        items: [],
      };
      group.items.push({
        id: String(row.id),
        due_date: String(row.due_date).slice(0, 10),
        amount,
        type: account.type,
      });
      groups.set(borrower.id, group);
    }

    const result = [...groups.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const g of result) {
      g.items.sort(
        (a, b) =>
          a.due_date.localeCompare(b.due_date) || a.type.localeCompare(b.type),
      );
    }

    return NextResponse.json({ date, groups: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
