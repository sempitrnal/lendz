/** Row fields used to derive paid / remaining for an installment. */
export type ScheduleBalanceInput = {
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  status: string;
};

export function amountPaidOnInstallment(row: ScheduleBalanceInput): number {
  const due = Math.max(0, Number(row.amount_due ?? 0));
  if (due <= 0) return 0;
  if (row.status === "paid") return due;
  const paid = Number(row.amount_paid ?? 0);
  return Math.min(due, Math.max(0, paid));
}

export function remainingOnInstallment(row: ScheduleBalanceInput): number {
  const due = Math.max(0, Number(row.amount_due ?? 0));
  if (row.status === "paid") return 0;

  const paidRaw = Math.min(due, Math.max(0, Number(row.amount_paid ?? 0)));
  const remRaw = row.remaining_amount;

  if (remRaw != null && !Number.isNaN(Number(remRaw))) {
    const rem = Math.max(0, Math.min(due, Number(remRaw)));
    /** DB default `remaining_amount = 0` makes every row look fully paid; ignore when still unpaid. */
    if (rem === 0 && paidRaw < due) {
      return Math.max(0, due - paidRaw);
    }
    return rem;
  }

  return Math.max(0, due - amountPaidOnInstallment(row));
}

export function isInstallmentFullyPaid(row: ScheduleBalanceInput): boolean {
  return row.status === "paid" || remainingOnInstallment(row) <= 0;
}
