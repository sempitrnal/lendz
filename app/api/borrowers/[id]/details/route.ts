import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  nextCollectionsForDisplay,
  nextDueScheduleForCollection,
  nextFutureScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: borrowerId } = await params;
  const supabase = await createSupabaseServer();

  // Fetch borrower basic info
  const { data: borrower, error: borrowerError } = await supabase
    .from("borrowers")
    .select("id, first_name, last_name, contact, created_at")
    .eq("id", borrowerId)
    .single();

  if (borrowerError || !borrower) {
    return NextResponse.json({ error: "Borrower not found" }, { status: 404 });
  }

  // Fetch accounts for this borrower
  const { data: accountsData } = await supabase
    .from("accounts")
    .select(
      "id, borrower_id, type, principal_amount, created_at, release_date, schedule_mode, interest_type, interest_rate, term_months, payment_frequency, term_installments, status, first_payment_date, calculate_skipped_schedules",
    )
    .eq("borrower_id", borrowerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const accountList = accountsData ?? [];

  // Fetch schedules for these accounts
  let schedules: Record<string, unknown>[] = [];
  if (accountList.length > 0) {
    const { data: schedulesData } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status, paid_date",
      )
      .in(
        "account_id",
        accountList.map((a) => a.id),
      )
      .order("due_date", { ascending: true });
    schedules = schedulesData ?? [];
  }

  const byAccount = new Map<string, typeof schedules>();
  for (const row of schedules) {
    const list = byAccount.get(row.account_id as string) ?? [];
    list.push(row);
    byAccount.set(row.account_id as string, list);
  }

  // Compute amount paid this month per account from schedule_payments
  const scheduleIds = schedules.map((s) => s.id as string);
  const paymentsByAccount = new Map<string, number>();
  if (scheduleIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from("schedule_payments")
      .select("schedule_id, amount, payment_date")
      .in("schedule_id", scheduleIds);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    for (const payment of (paymentsData ?? []) as {
      schedule_id: string;
      amount: number | null;
      payment_date: string | null;
    }[]) {
      if (!payment.payment_date || payment.amount == null) continue;
      const paymentDate = new Date(payment.payment_date);
      if (
        paymentDate.getFullYear() !== currentYear ||
        paymentDate.getMonth() !== currentMonth
      ) {
        continue;
      }
      const accountId = schedules.find(
        (s) => s.id === payment.schedule_id,
      )?.account_id;
      if (!accountId) continue;
      paymentsByAccount.set(
        accountId as string,
        (paymentsByAccount.get(accountId as string) ?? 0) +
          Number(payment.amount),
      );
    }
  }

  // Compute metrics per account
  const metrics: Record<string, unknown> = {};
  for (const account of accountList) {
    const rows = byAccount.get(account.id) ?? [];
    const totalPayment = rows.reduce(
      (sum, row) => sum + Number((row as any).amount_due ?? 0),
      0,
    );
    const amountPaid = rows.reduce(
      (sum, row) => sum + amountPaidOnInstallment(row as any),
      0,
    );
    const amountLeftToPayRaw = rows.reduce(
      (sum, row) => sum + remainingOnInstallment(row as any),
      0,
    );
    const amountLeftToPayRolling = rows
      .filter((row) => (row as any).status !== "partial")
      .reduce((sum, row) => sum + remainingOnInstallment(row as any), 0);
    const principal = Number(account.principal_amount ?? 0);
    const interestRate = Number(account.interest_rate ?? 0);
    const isManual = account.schedule_mode === "manual";
    const isRolling = isManual && account.interest_type === "rolling";
    const isFlatManual = isManual && !isRolling;
    const manualFlatTotal = isFlatManual
      ? principal * (1 + interestRate / 100)
      : 0;
    const amountLeftToPay = isFlatManual
      ? Math.max(0, manualFlatTotal - amountPaid)
      : isRolling
        ? amountLeftToPayRolling
        : amountLeftToPayRaw;
    const rollingContract = isRolling ? amountPaid + amountLeftToPay : 0;
    const profitToMake = isFlatManual
      ? manualFlatTotal - principal
      : isRolling
        ? Math.max(0, rollingContract - principal)
        : Math.max(0, totalPayment - principal);
    const nextUnpaid = nextFutureScheduleForCollection(rows as any);
    const nextCollections = nextCollectionsForDisplay(rows as any).map((r) => ({
      due_date: r.due_date,
      amount: remainingOnInstallment(r),
      amount_due: Math.max(0, Number(r.amount_due ?? 0)),
      status: r.status,
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

  // Fetch notes
  const { data: notesData, error: notesError } = await supabase
    .from("borrower_notes")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  let notes = notesData ?? [];

  if (notesError && notesError.message.includes("sort_order")) {
    const { data: fallbackNotes } = await supabase
      .from("borrower_notes")
      .select("*")
      .eq("borrower_id", borrowerId)
      .order("created_at", { ascending: false });
    notes = fallbackNotes ?? [];
  }

  return NextResponse.json({
    borrower,
    accounts: accountList,
    metrics,
    notes,
  });
}
