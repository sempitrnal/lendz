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

/**
 * Next installment to collect for an account: earliest unpaid row with status `pending`;
 * if none (e.g. only partial/overdue), earliest unpaid. Pass rows sorted by due_date.
 */
export function nextDueScheduleForCollection<
  T extends ScheduleBalanceInput & { due_date: string },
>(schedulesSortedByDueDate: T[]): T | undefined {
  const unpaid = schedulesSortedByDueDate.filter((r) => !isInstallmentFullyPaid(r));
  const pending = unpaid.find((r) => r.status === "pending");
  if (pending) return pending;
  return unpaid[0];
}

/** Groups rows by `account_id`, sorts by due_date (optional `id` tiebreak), then picks next due per account. */
export function mapAccountIdToNextDueSchedule<
  T extends ScheduleBalanceInput & { account_id: string; due_date: string; id?: string },
>(rows: T[]): Map<string, T> {
  const byAccount = new Map<string, T[]>();
  for (const row of rows) {
    const list = byAccount.get(row.account_id) ?? [];
    list.push(row);
    byAccount.set(row.account_id, list);
  }
  const out = new Map<string, T>();
  for (const [accountId, list] of byAccount) {
    list.sort((a, b) => {
      const byDue = a.due_date.localeCompare(b.due_date);
      if (byDue !== 0) return byDue;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
    const next = nextDueScheduleForCollection(list);
    if (next) out.set(accountId, next);
  }
  return out;
}
