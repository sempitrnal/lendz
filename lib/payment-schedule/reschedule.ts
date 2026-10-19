/**
 * Plans how an account edit applies to its existing payment schedules.
 *
 * "carry" keeps the existing rows and moves them onto the new dates in order
 * (1st installment to 1st, 2nd to 2nd, ...). Each row keeps its id, so its
 * payment records (which cascade-delete with the row) and the checklist rows
 * that link to it survive; only the due date and amount change, and the
 * status is worked out again from what was paid. Fixing a wrong pattern (5th
 * & 20th entered as 4th & 19th) keeps every payment where it was.
 *
 * "reset" replaces every row with the new schedule, all unpaid.
 */

export type RescheduleMode = "carry" | "reset";

export type ExistingSchedule = {
  id: string;
  due_date: string;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  status: string;
};

export type NewSchedule = {
  account_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining_amount: number;
  status: string;
  note: null;
};

export type ScheduleUpdate = {
  id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining_amount: number;
  status: string;
};

export type ReschedulePlan = {
  updates: ScheduleUpdate[];
  inserts: NewSchedule[];
  deletes: string[];
  /**
   * Existing rows with money on them that the new terms have no installment
   * for. Deleting them would lose their payments, so the edit must not go
   * ahead while this is non-empty.
   */
  blocked: ExistingSchedule[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What was actually paid on a row; old rows marked paid may have no amount. */
function paidOn(row: ExistingSchedule): number {
  const paid = Math.max(0, Number(row.amount_paid ?? 0));
  if (row.status === "paid" && paid <= 0) {
    return Math.max(0, Number(row.amount_due ?? 0));
  }
  return paid;
}

/** Status for an installment from what was paid and when it is due. */
export function statusFor(
  amountDue: number,
  amountPaid: number,
  dueDate: string,
  today: string,
): string {
  if (amountPaid > 0 && amountPaid + 0.005 >= amountDue) return "paid";
  if (amountPaid > 0) return "partial";
  // Same rule as the overdue job: unpaid and due before today.
  return dueDate < today ? "overdue" : "pending";
}

export function planReschedule(
  existing: ExistingSchedule[],
  next: NewSchedule[],
  mode: RescheduleMode,
  today: string,
): ReschedulePlan {
  const old = [...existing].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const fresh = [...next].sort((a, b) => a.due_date.localeCompare(b.due_date));

  if (mode === "reset") {
    return {
      updates: [],
      inserts: fresh,
      deletes: old.map((r) => r.id),
      blocked: [],
    };
  }

  const updates: ScheduleUpdate[] = [];
  const pairs = Math.min(old.length, fresh.length);
  for (let i = 0; i < pairs; i++) {
    const row = old[i];
    const target = fresh[i];
    const paid = round2(paidOn(row));
    const due = target.amount_due;
    updates.push({
      id: row.id,
      due_date: target.due_date,
      amount_due: due,
      amount_paid: paid,
      remaining_amount: round2(Math.max(0, due - paid)),
      status: statusFor(due, paid, target.due_date, today),
    });
  }

  const surplus = old.slice(pairs);
  return {
    updates,
    inserts: fresh.slice(pairs),
    deletes: surplus.filter((r) => paidOn(r) <= 0).map((r) => r.id),
    blocked: surplus.filter((r) => paidOn(r) > 0),
  };
}

/** Counts for telling the user what a carry-over keeps. */
export function summarizeCarry(existing: ExistingSchedule[]) {
  let paid = 0;
  let partial = 0;
  for (const row of existing) {
    const amount = paidOn(row);
    if (amount <= 0) continue;
    if (row.status === "paid" || amount + 0.005 >= Number(row.amount_due ?? 0)) {
      paid += 1;
    } else {
      partial += 1;
    }
  }
  return { paid, partial };
}
