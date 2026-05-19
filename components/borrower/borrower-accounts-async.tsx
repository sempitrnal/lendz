import { createSupabaseServer } from "@/lib/supabase/server";
import BorrowerAccountsSection, {
  type AccountRow,
  type AccountComputedMetrics,
} from "@/components/borrower/borrower-accounts-section";
import { BorrowerSummary } from "./borrower-detail-view";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  nextDueScheduleForCollection,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

type BorrowerAccountsAsyncProps = {
  borrowerId: string;
  borrower?: BorrowerSummary
};

export default async function BorrowerAccountsAsync({
  borrowerId,
  borrower
}: BorrowerAccountsAsyncProps) {
  const supabase = await createSupabaseServer();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: false });

  const accountList = (accounts ?? []) as AccountRow[];
  const initialMetrics: Record<string, AccountComputedMetrics> = {};

  if (accountList.length > 0) {
    const { data: schedulesData } = await supabase
      .from("payment_schedules")
      .select("id, account_id, due_date, amount_due, amount_paid, remaining_amount, status")
      .in("account_id", accountList.map((a) => a.id))
      .order("due_date", { ascending: true });

    const scheduleRows = schedulesData ?? [];
    const byAccount = new Map<string, typeof scheduleRows>();
    scheduleRows.forEach((row) => {
      const prev = byAccount.get(row.account_id) ?? [];
      prev.push(row);
      byAccount.set(row.account_id, prev);
    });

    accountList.forEach((account) => {
      const rows = byAccount.get(account.id) ?? [];
      const totalPayment = rows.reduce((sum, row) => sum + Number(row.amount_due ?? 0), 0);
      const amountPaid = rows.reduce((sum, row) => sum + amountPaidOnInstallment(row), 0);
      const amountLeftToPayRaw = rows.reduce((sum, row) => sum + remainingOnInstallment(row), 0);
      const principal = Number(account.principal_amount ?? 0);
      const isManual = account.schedule_mode === "manual";
      const amountLeftToPay = isManual ? Math.max(0, principal - amountPaid) : amountLeftToPayRaw;
      const profitToMake = Math.max(0, totalPayment - principal);
      const nextUnpaid = nextDueScheduleForCollection(rows);
      const overdueRows = rows.filter((row) => row.status === "overdue" && !isInstallmentFullyPaid(row));
      initialMetrics[account.id] = {
        amountLeftToPay,
        profitToMake,
        nextCollectionDate: nextUnpaid?.due_date ?? null,
        nextCollectionAmount: nextUnpaid ? remainingOnInstallment(nextUnpaid) : 0,
        nextCollectionStatus: nextUnpaid?.status ?? null,
        nextUnpaidScheduleId: nextUnpaid?.id ?? null,
        overdueCount: overdueRows.length,
        totalDue: totalPayment,
        totalPaid: amountPaid,
        term_months: account.term_months,
        term_installments: account.term_installments,
        schedule_mode: account.schedule_mode,
        overdueTotal: overdueRows.reduce((sum, row) => sum + remainingOnInstallment(row), 0),
      };
    });
  }

  return (
    <BorrowerAccountsSection
      borrower={borrower}
      borrowerId={borrowerId}
      accounts={accountList}
      initialMetrics={initialMetrics}
    />
  );
}
