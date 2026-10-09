import { parseExistingNext } from "@/lib/checklist/labels";

export type ChecklistTotals = {
  /** Sum of every linked collection line in the given items. */
  expected: number;
  /** The part of `expected` sitting on checked-off items. */
  checkedOff: number;
  /** `expected - checkedOff`. */
  left: number;
  collections: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/** Totals for linked collection lines (the `Total:` lines are not counted). */
export function summarizeChecklist(
  items: { label: string; is_checked: boolean }[],
): ChecklistTotals {
  let expected = 0;
  let checkedOff = 0;
  let collections = 0;
  for (const item of items) {
    const lines = parseExistingNext(item.label);
    const amount = lines.reduce((sum, l) => sum + l.amount, 0);
    collections += lines.length;
    expected += amount;
    if (item.is_checked) checkedOff += amount;
  }
  return {
    expected: cents(expected),
    checkedOff: cents(checkedOff),
    left: cents(expected - checkedOff),
    collections,
  };
}
