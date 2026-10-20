import { describe, expect, it } from "vitest";
import { buildDueLabel } from "@/lib/checklist/labels";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import type { DailyChecklistItem } from "@/lib/checklist/types";
import { buildRowView } from "@/lib/checklist/row-state";

const id = (i: number) => `00000000-0000-4000-8000-00000000000${i}`;

function item(
  lines: { due: string; amount: number }[],
  opts: { checked?: boolean; date?: string } = {},
): DailyChecklistItem {
  return {
    id: "i1",
    checklist_date: opts.date ?? "2026-10-10",
    label: buildDueLabel({
      borrower_id: "b1",
      name: "ana",
      items: lines.map((l, i) => ({
        id: id(i),
        due_date: l.due,
        amount: l.amount,
        type: "loan" as const,
      })),
    }),
    is_checked: opts.checked ?? false,
    sort_order: 0,
    created_at: "2026-10-01T00:00:00Z",
    category_id: null,
    daily_checklist_categories: null,
  };
}

function sched(
  i: number,
  p: Partial<ScheduleDialogRow> & { amount_due: number },
): [string, ScheduleDialogRow] {
  return [
    id(i),
    {
      id: id(i),
      account_id: "a1",
      due_date: "2026-10-10",
      amount_paid: 0,
      remaining_amount: p.amount_due,
      status: "pending",
      ...p,
    },
  ];
}

describe("buildRowView", () => {
  it("a line takes its state from its saved schedule", () => {
    const it1 = item([
      { due: "2026-10-10", amount: 100 },
      { due: "2026-10-10", amount: 200 },
      { due: "2026-10-10", amount: 300 },
    ]);
    const map = new Map([
      sched(0, { amount_due: 100, amount_paid: 100, remaining_amount: 0, status: "paid" }),
      sched(1, { amount_due: 200, amount_paid: 50, remaining_amount: 150, status: "partial" }),
      sched(2, { amount_due: 300 }),
    ]);
    const v = buildRowView(it1, map);
    expect(v.lines.map((l) => l.state)).toEqual(["paid", "partial", "unpaid"]);
    expect(v.lines.map((l) => l.left)).toEqual([0, 150, 300]);
    expect(v.lines.map((l) => l.paid)).toEqual([100, 50, 0]);
    expect(v.left).toBe(450);
    expect(v.total).toBe(600);
  });

  it("a line with no saved schedule follows the tick", () => {
    const lines = [{ due: "2026-10-10", amount: 100 }];
    const open = buildRowView(item(lines));
    expect(open.status).toBe("unpaid");
    expect(open.left).toBe(100);
    const done = buildRowView(item(lines, { checked: true }));
    expect(done.status).toBe("paid");
    expect(done.left).toBe(0);
  });

  it("status is partial when some lines are paid and others are not", () => {
    const it1 = item([
      { due: "2026-10-10", amount: 100 },
      { due: "2026-10-10", amount: 200 },
    ]);
    const map = new Map([
      sched(0, { amount_due: 100, amount_paid: 100, remaining_amount: 0, status: "paid" }),
      sched(1, { amount_due: 200 }),
    ]);
    expect(buildRowView(it1, map).status).toBe("partial");
  });

  it("a line is overdue only when its schedule says overdue", () => {
    const lines = [{ due: "2026-10-05", amount: 100 }];
    const pending = new Map([sched(0, { amount_due: 100, status: "pending" })]);
    expect(buildRowView(item(lines), pending).lines[0].overdue).toBe(false);
    const od = new Map([sched(0, { amount_due: 100, status: "overdue" })]);
    const v = buildRowView(item(lines), od);
    expect(v.lines[0].overdue).toBe(true);
    expect(v.lateDays).toBe(5);
    const none = buildRowView(item(lines));
    expect(none.lines[0].overdue).toBe(true);
    expect(none.lateDays).toBe(5);
  });

  it("lateDays is the largest daysOverdue among overdue lines", () => {
    const v = buildRowView(
      item([
        { due: "2026-10-08", amount: 100 },
        { due: "2026-10-02", amount: 100 },
      ]),
    );
    expect(v.lateDays).toBe(8);
  });

  it("carried is true only when every line is due before the checklist date", () => {
    expect(buildRowView(item([{ due: "2026-10-05", amount: 1 }])).carried).toBe(true);
    expect(
      buildRowView(
        item([
          { due: "2026-10-05", amount: 1 },
          { due: "2026-10-10", amount: 1 },
        ]),
      ).carried,
    ).toBe(false);
  });

  it("dueOnDay is true when an unsettled line is due on the checklist date", () => {
    const lines = [
      { due: "2026-10-05", amount: 1 },
      { due: "2026-10-10", amount: 1 },
    ];
    expect(buildRowView(item(lines)).dueOnDay).toBe(true);
    const map = new Map([
      sched(0, { amount_due: 1 }),
      sched(1, { amount_due: 1, amount_paid: 1, remaining_amount: 0, status: "paid" }),
    ]);
    expect(buildRowView(item(lines), map).dueOnDay).toBe(false);
  });

  it("a label without collection lines is a plain note", () => {
    const base = { ...item([]), label: "buy milk" };
    const v = buildRowView(base);
    expect(v.model).toBeNull();
    expect(v.lines).toEqual([]);
    expect(v.total).toBe(0);
    expect(v.left).toBe(0);
    expect(v.status).toBe("unpaid");
    expect(buildRowView({ ...base, is_checked: true }).status).toBe("paid");
  });
});
