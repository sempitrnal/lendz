import { parseExistingNext } from "@/lib/checklist/labels";
import {
  remainingOnInstallment,
  type ScheduleBalanceInput,
} from "@/lib/payment-schedule/schedule-balances";

export type ChecklistTotals = {
  /** Sum of every linked collection line in the given items. */
  expected: number;
  /** The part of `expected` collected so far. */
  checkedOff: number;
  /** `expected - checkedOff`. */
  left: number;
  collections: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Totals for linked collection lines (the `Total:` lines are not counted).
 *
 * With `schedules` (schedule rows by id), each line counts what has been paid
 * toward it: its listed amount minus what the schedule still owes, so a paid
 * schedule counts in full and a partial one counts its payments, whether or
 * not the row is ticked. Lines without a known schedule fall back to the tick.
 */
export function summarizeChecklist(
  items: { label: string; is_checked: boolean }[],
  schedules?: Map<string, ScheduleBalanceInput>,
): ChecklistTotals {
  let expected = 0;
  let checkedOff = 0;
  let collections = 0;
  for (const item of items) {
    for (const line of parseExistingNext(item.label)) {
      collections += 1;
      expected += line.amount;
      const row = schedules?.get(line.id);
      if (row) {
        const owed = remainingOnInstallment(row);
        checkedOff += Math.min(line.amount, Math.max(0, line.amount - owed));
      } else if (item.is_checked) {
        checkedOff += line.amount;
      }
    }
  }
  return {
    expected: cents(expected),
    checkedOff: cents(checkedOff),
    left: cents(expected - checkedOff),
    collections,
  };
}
