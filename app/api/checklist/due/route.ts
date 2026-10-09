import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { remainingOnInstallment } from "@/lib/payment-schedule/schedule-balances";

export type DueChecklistItem = {
  id: string;
  due_date: string;
  amount: number;
  type: "loan" | "cash_advance";
};

export type DueChecklistGroup = {
  borrower_id: string;
  name: string;
  items: DueChecklistItem[];
};

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();

    const { data: accountsData, error: accountsError } = await supabase
      .from("accounts")
      .select("id, borrower_id, type, schedule_mode")
      .in("type", ["loan", "cash_advance"])
      .is("deleted_at", null);
    if (accountsError) throw new Error(accountsError.message);

    const accounts = new Map(
      (accountsData ?? [])
        .filter((a) => a.schedule_mode !== "manual")
        .map((a) => [a.id as string, a]),
    );

    const { data: schedules, error: schedulesError } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status",
      )
      .eq("due_date", date)
      .neq("status", "paid");
    if (schedulesError) throw new Error(schedulesError.message);

    const { data: borrowersData, error: borrowersError } = await supabase
      .from("borrowers")
      .select("id, first_name, last_name")
      .is("deleted_at", null);
    if (borrowersError) throw new Error(borrowersError.message);
    const borrowers = new Map(
      (borrowersData ?? []).map((b) => [b.id as string, b]),
    );

    const groups = new Map<string, DueChecklistGroup>();
    for (const row of schedules ?? []) {
      const account = accounts.get(String(row.account_id));
      if (!account) continue;
      const borrower = borrowers.get(String(account.borrower_id));
      if (!borrower) continue;
      const amount = remainingOnInstallment({
        amount_due: row.amount_due as number | null,
        amount_paid: row.amount_paid as number | null,
        remaining_amount: row.remaining_amount as number | null,
        status: String(row.status),
      });
      if (amount <= 0) continue;

      const group = groups.get(borrower.id) ?? {
        borrower_id: borrower.id as string,
        name: `${borrower.first_name} ${borrower.last_name}`.trim(),
        items: [],
      };
      group.items.push({
        id: String(row.id),
        due_date: String(row.due_date).slice(0, 10),
        amount,
        type: account.type as "loan" | "cash_advance",
      });
      groups.set(borrower.id as string, group);
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
