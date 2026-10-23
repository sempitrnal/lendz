import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { installmentDots } from "@/lib/payment-schedule/installment-dots";
import { installmentProfit, principalShare } from "@/lib/checklist/profit";
import {
  accountBalances,
  isInstallmentFullyPaid,
  nextCollectionsForDisplay,
  nextDueScheduleForCollection,
  nextFutureScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

async function loadNotes(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  borrowerId: string,
) {
  const { data, error } = await supabase
    .from("borrower_notes")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!error) return data ?? [];

  // Older databases don't have sort_order yet.
  if (error.message.includes("sort_order")) {
    const { data: fallback } = await supabase
      .from("borrower_notes")
      .select("*")
      .eq("borrower_id", borrowerId)
      .order("created_at", { ascending: false });
    return fallback ?? [];
  }
  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: borrowerId } = await params;
  const supabase = await createSupabaseServer();

  // The borrower, their accounts and their notes don't depend on each other.
  const [borrowerRes, accountsRes, notes] = await Promise.all([
    supabase
      .from("borrowers")
      .select("id, first_name, last_name, contact, created_at")
      .eq("id", borrowerId)
      .single(),
    supabase
      .from("accounts")
      .select(
        "id, borrower_id, type, principal_amount, created_at, release_date, schedule_mode, interest_type, interest_rate, term_months, payment_frequency, term_installments, status, first_payment_date, calculate_skipped_schedules",
      )
      .eq("borrower_id", borrowerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    loadNotes(supabase, borrowerId),
  ]);

  const borrower = borrowerRes.data;
  if (borrowerRes.error || !borrower) {
    return NextResponse.json({ error: "Borrower not found" }, { status: 404 });
  }

  const accountList = accountsRes.data ?? [];

  // Schedules for these accounts, and this month's payments toward them.
  let schedules: Record<string, unknown>[] = [];
  const paymentsByAccount = new Map<string, number>();
  if (accountList.length > 0) {
    const accountIds = accountList.map((a) => a.id);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStart = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`;

    const [{ data: schedulesData }, { data: paymentsData }] = await Promise.all(
      [
        supabase
          .from("payment_schedules")
          .select(
            "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status, paid_date",
          )
          .in("account_id", accountIds)
          .order("due_date", { ascending: true }),
        supabase
          .from("schedule_payments")
          .select("amount, payment_schedules!inner(account_id)")
          .in("payment_schedules.account_id", accountIds)
          .gte("payment_date", monthStart)
          .lt("payment_date", nextMonthStart),
      ],
    );
    schedules = schedulesData ?? [];

    for (const payment of (paymentsData ?? []) as unknown as {
      amount: number | null;
      payment_schedules:
        | { account_id: string }
        | { account_id: string }[]
        | null;
    }[]) {
      if (payment.amount == null) continue;
      const schedule = Array.isArray(payment.payment_schedules)
        ? payment.payment_schedules[0]
        : payment.payment_schedules;
      if (!schedule) continue;
      paymentsByAccount.set(
        schedule.account_id,
        (paymentsByAccount.get(schedule.account_id) ?? 0) +
          Number(payment.amount),
      );
    }
  }

  const byAccount = new Map<string, typeof schedules>();
  for (const row of schedules) {
    const list = byAccount.get(row.account_id as string) ?? [];
    list.push(row);
    byAccount.set(row.account_id as string, list);
  }

  const today = new Date().toISOString().slice(0, 10);

  // Compute metrics per account
  const metrics: Record<string, unknown> = {};
  for (const account of accountList) {
    const rows = byAccount.get(account.id) ?? [];
    const {
      isManual,
      isFlatManual,
      totalPayment,
      manualFlatTotal,
      amountPaid,
      amountLeftToPay,
      profitToMake,
    } = accountBalances(account, rows as any);
    const nextUnpaid = nextFutureScheduleForCollection(rows as any);
    const nextCollections = nextCollectionsForDisplay(rows as any).map((r) => ({
      due_date: r.due_date,
      amount: remainingOnInstallment(r),
      amount_due: Math.max(0, Number(r.amount_due ?? 0)),
      status: r.status,
    }));
    const dueCollections = rows
      .filter((row) => {
        const due = String((row as any).due_date ?? "").slice(0, 10);
        return (
          remainingOnInstallment(row as any) > 0 &&
          (due <= today ||
            (row as any).status === "partial" ||
            (nextUnpaid && (row as any).id === (nextUnpaid as any).id))
        );
      })
      .map((row) => ({
        id: String((row as any).id ?? ""),
        due_date: String((row as any).due_date ?? "").slice(0, 10),
        amount: remainingOnInstallment(row as any),
        // What this due earns once paid, for the checklist's next-dues list.
        profit: installmentProfit(
          Number((row as any).amount_due ?? 0),
          principalShare(account),
        ),
        status: (row as any).status,
      }));
    const overdueRows = rows.filter(
      (row) =>
        (row as any).status === "overdue" &&
        !isInstallmentFullyPaid(row as any),
    );
    const daysSinceRelease = account.release_date
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(account.release_date).getTime()) / 86400000,
          ),
        )
      : 0;
    const termMonths = Number(account.term_months) || 0;
    const freq = account.payment_frequency;
    const installments = isManual
      ? Number(account.term_installments) || termMonths || 1
      : freq === "custom"
        ? Number(account.term_installments) || 1
        : freq === "bimonthly"
          ? termMonths * 2 || 1
          : freq === "weekly"
            ? termMonths * 4 || 1
            : termMonths || 1;
    const profitPerSchedule = profitToMake / installments;

    metrics[account.id] = {
      amountLeftToPay,
      profitToMake,
      daysSinceRelease,
      profitPerSchedule,
      nextCollectionDate: nextUnpaid?.due_date ?? null,
      nextCollectionAmount: nextUnpaid ? remainingOnInstallment(nextUnpaid) : 0,
      nextCollectionAmountDue: nextUnpaid
        ? Math.max(0, Number(nextUnpaid.amount_due ?? 0))
        : 0,
      amountPaidThisMonth: paymentsByAccount.get(account.id) ?? 0,
      nextCollectionStatus: nextUnpaid?.status ?? null,
      nextUnpaidScheduleId: (nextUnpaid as any)?.id ?? null,
      nextCollections,
      installments: installmentDots(rows as any),
      dueCollections,
      overdueCount: overdueRows.length,
      overdueTotal: overdueRows.reduce(
        (sum, row) => sum + remainingOnInstallment(row as any),
        0,
      ),
      overdueSchedules: [...overdueRows]
        .sort((a, b) => (a as any).due_date.localeCompare((b as any).due_date))
        .map((row) => ({
          due_date: (row as any).due_date,
          amount: remainingOnInstallment(row as any),
        })),
      totalDue: isFlatManual ? manualFlatTotal : totalPayment,
      totalPaid: amountPaid,
      term_months: account.term_months,
      term_installments: account.term_installments,
      schedule_mode: account.schedule_mode,
    };
  }

  return NextResponse.json({
    borrower,
    accounts: accountList,
    metrics,
    notes,
  });
}
