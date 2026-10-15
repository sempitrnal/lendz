import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  type ScheduleBalanceInput,
} from "@/lib/payment-schedule/schedule-balances";

export type InstallmentState = "paid" | "partial" | "overdue" | "pending";

/** One installment of an account, as drawn by the borrower page's schedule dots. */
export type InstallmentDot = {
  due_date: string;
  state: InstallmentState;
  amount_due: number;
  amount_paid: number;
};

/**
 * Every installment of an account in due-date order, reduced to what the
 * schedule dots need. A schedule with money on it that isn't fully paid is
 * partial; otherwise it follows its stored status (overdue or pending).
 */
export function installmentDots(
  rows: (ScheduleBalanceInput & { due_date: string })[],
): InstallmentDot[] {
  return [...rows]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((row) => {
      const amountPaid = amountPaidOnInstallment(row);
      const state: InstallmentState = isInstallmentFullyPaid(row)
        ? "paid"
        : amountPaid > 0
          ? "partial"
          : row.status === "overdue"
            ? "overdue"
            : "pending";
      return {
        due_date: String(row.due_date).slice(0, 10),
        state,
        amount_due: Math.max(0, Number(row.amount_due ?? 0)),
        amount_paid: amountPaid,
      };
    });
}
