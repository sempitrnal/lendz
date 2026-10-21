import {
  collectionRowModel,
  type CollectionRowLine,
  type CollectionRowModel,
} from "@/lib/checklist/labels";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import type { DailyChecklistItem } from "@/lib/checklist/types";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

export type LineState = "paid" | "partial" | "unpaid";

export type RowLine = CollectionRowLine & {
  state: LineState;
  paid: number;
  left: number;
  overdue: boolean;
  /** What is recorded as paid on the saved schedule (0 with none saved). */
  recorded: number;
  /** The installment's own amount: the saved schedule's, else the label's. */
  original: number;
};

export type RowStatus = "paid" | "partial" | "unpaid";

export type RowView = {
  item: DailyChecklistItem;
  model: CollectionRowModel | null;
  lines: RowLine[];
  status: RowStatus;
  left: number;
  total: number;
  lateDays: number;
  dueOnDay: boolean;
  carried: boolean;
};

const cents = (n: number) => Math.round(n * 100) / 100;

function buildLine(
  line: CollectionRowLine,
  ticked: boolean,
  schedules?: Map<string, ScheduleDialogRow>,
): RowLine {
  const row = schedules?.get(line.id);
  let state: LineState;
  let left: number;
  if (row) {
    // The saved schedule is the truth: the label's amount is only what was
    // typed when the item was made, and can be stale (a payment undone).
    left = remainingOnInstallment(row);
    state =
      row.status === "paid"
        ? "paid"
        : Number(row.amount_paid ?? 0) > 0
          ? "partial"
          : "unpaid";
  } else {
    state = ticked ? "paid" : "unpaid";
    left = ticked ? 0 : line.amount;
  }
  left = cents(left);
  const overdue =
    state !== "paid" &&
    line.daysOverdue > 0 &&
    (row ? row.status === "overdue" : true);
  return {
    ...line,
    state,
    left,
    paid: cents((row ? Number(row.amount_due) : line.amount) - left),
    overdue,
    recorded: row ? cents(amountPaidOnInstallment(row)) : 0,
    original: row ? cents(Number(row.amount_due)) : line.amount,
  };
}

export function buildRowView(
  item: DailyChecklistItem,
  schedules?: Map<string, ScheduleDialogRow>,
): RowView {
  const model = collectionRowModel(item.label, item.checklist_date);
  if (!model) {
    return {
      item,
      model: null,
      lines: [],
      status: item.is_checked ? "paid" : "unpaid",
      left: 0,
      total: 0,
      lateDays: 0,
      dueOnDay: false,
      carried: false,
    };
  }

  const lines = model.lines.map((l) =>
    buildLine(l, item.is_checked, schedules),
  );
  const left = cents(lines.reduce((sum, l) => sum + l.left, 0));
  const status: RowStatus = lines.every((l) => l.state === "paid")
    ? "paid"
    : lines.some((l) => l.state !== "unpaid")
      ? "partial"
      : "unpaid";
  const lateDays = lines.reduce(
    (max, l) => (l.overdue ? Math.max(max, l.daysOverdue) : max),
    0,
  );
  const day = item.checklist_date.slice(0, 10);
  return {
    item,
    model,
    lines,
    status,
    left,
    total: model.total,
    lateDays,
    dueOnDay: lines.some(
      (l) => l.state !== "paid" && l.due_date.slice(0, 10) === day,
    ),
    carried: lines.every((l) => l.due_date.slice(0, 10) < day),
  };
}
