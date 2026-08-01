import {
  amountPaidOnInstallment,
  remainingOnInstallment,
  isInstallmentFullyPaid,
} from "@/lib/payment-schedule/schedule-balances";
import { formatDate, formatMoney } from "@/lib/utils";
import type { AccountDetailData } from "@/lib/cache/accounts";
import type { PaymentScheduleItem } from "@/components/components-2/dashboard/payment-schedules";

export type PublicAccountViewModel = {
  id: string;
  borrowerName: string;
  accountType: string;
  principal: number;
  interestRate: number;
  termMonths: number | null;
  paymentFrequency: string | null;
  releaseDate: string | null;
  paidTotal: number;
  totalRemaining: number;
  totalDue: number;
  progressPct: number;
  paidCount: number;
  nextDue: {
    amount: number;
    remaining: number;
    dueDate: string;
  } | null;
  nextNumber: number | null;
  scheduleItems: PaymentScheduleItem[];
};

export function buildPublicAccountView(
  id: string,
  data: AccountDetailData,
): PublicAccountViewModel {
  const { account, borrower, schedules } = data;

  const principal = Number(account.principal_amount ?? 0);
  const interestRate = Number(account.interest_rate ?? 0);

  const paidTotal = schedules.reduce(
    (sum, s) => sum + amountPaidOnInstallment(s),
    0,
  );
  const totalRemaining = schedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0,
  );
  const totalDue = schedules.reduce(
    (sum, s) => sum + Number(s.amount_due ?? 0),
    0,
  );
  const progressPct =
    totalDue > 0 ? Math.min(100, Math.round((paidTotal / totalDue) * 100)) : 0;

  const paidCount = schedules.filter((s) => isInstallmentFullyPaid(s)).length;
  const nextDueIndex = schedules.findIndex((s) => s.status === "pending");
  const nextDue = nextDueIndex >= 0 ? schedules[nextDueIndex] : null;
  const nextNumber = nextDueIndex >= 0 ? nextDueIndex + 1 : null;

  const scheduleItems: PaymentScheduleItem[] = schedules.map((s, i) => ({
    id: s.id,
    number: i + 1,
    amount: Math.max(0, Number(s.amount_due ?? 0)),
    dueDate: formatDate(s.due_date),
    status: s.status as PaymentScheduleItem["status"],
    paid: amountPaidOnInstallment(s),
    remaining: remainingOnInstallment(s),
    paidDate: s.paid_date,
    note: s.note,
  }));

  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Borrower";

  return {
    id,
    borrowerName,
    accountType: account.type,
    principal,
    interestRate,
    termMonths: account.term_months,
    paymentFrequency: account.payment_frequency,
    releaseDate: account.release_date,
    paidTotal,
    totalRemaining,
    totalDue,
    progressPct,
    paidCount,
    nextDue: nextDue
      ? {
          amount: Math.max(0, Number(nextDue.amount_due ?? 0)),
          remaining: remainingOnInstallment(nextDue),
          dueDate: formatDate(nextDue.due_date),
        }
      : null,
    nextNumber,
    scheduleItems,
  };
}

export function describePublicAccount(view: PublicAccountViewModel): string {
  const typeLabel = view.accountType.replace("_", " ");
  return `${formatMoney(view.principal)} ${typeLabel} · ${view.progressPct}% paid · ${view.scheduleItems.length} installment${view.scheduleItems.length === 1 ? "" : "s"}`;
}
