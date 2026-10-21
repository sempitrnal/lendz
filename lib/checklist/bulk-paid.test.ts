import { describe, expect, it } from "vitest";
import {
  buildBulkPaid,
  bulkPaidRows,
  bulkPayFailureText,
  bulkScheduleIds,
  bulkUndoOutcome,
  splitBulkUndo,
  type BulkUndoResult,
} from "@/lib/checklist/bulk-paid";
import { buildDueLabel } from "@/lib/checklist/labels";
import { buildRowView, type RowView } from "@/lib/checklist/row-state";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const DAY = "2026-10-20";
const CUTOFF = "2026-10-21";

function sched(
  id: string,
  over: Partial<ScheduleDialogRow> = {},
): ScheduleDialogRow {
  return {
    id,
    account_id: `acc-${id}`,
    due_date: DAY,
    amount_due: 1000,
    amount_paid: 0,
    remaining_amount: 1000,
    status: "pending",
    ...over,
  };
}

function item(
  id: string,
  label: string,
  over: Partial<DailyChecklistItem> = {},
): DailyChecklistItem {
  return {
    id,
    checklist_date: DAY,
    label,
    is_checked: false,
    sort_order: 0,
    created_at: "2026-10-20T00:00:00Z",
    category_id: null,
    daily_checklist_categories: null,
    ...over,
  };
}

/** A collection row for `borrower` linking `ids` (₱1,000 each). */
function row(
  itemId: string,
  borrower: string,
  ids: string[],
  schedules: ScheduleDialogRow[],
  over: Partial<DailyChecklistItem> = {},
): RowView {
  const label = buildDueLabel({
    borrower_id: `b-${borrower}`,
    name: borrower,
    items: ids.map((id) => ({
      id,
      due_date: DAY,
      amount: 1000,
      type: "loan" as const,
    })),
  });
  return buildRowView(
    item(itemId, label, over),
    new Map(schedules.map((s) => [s.id, s])),
  );
}

describe("bulkPaidRows", () => {
  it("keeps every unticked collection row, paid ones too (the old dialog's rule)", () => {
    const s = [
      sched("s1"),
      sched("s2", { status: "paid", amount_paid: 1000, remaining_amount: 0 }),
      sched("s3"),
    ];
    const unpaid = row("i1", "ana", ["s1"], s);
    const paid = row("i2", "ben", ["s2"], s);
    const tickedUnpaid = row("i3", "cy", ["s3"], s, { is_checked: true });
    const note = buildRowView(item("i4", "call the bank"));
    expect(
      bulkPaidRows([unpaid, paid, tickedUnpaid, note]).map((r) => r.item.id),
    ).toEqual(["i1", "i2"]);
  });

  it("lists every linked schedule once", () => {
    const s = [sched("s1"), sched("s2")];
    expect(
      bulkScheduleIds([
        row("i1", "ana", ["s1", "s2"], s),
        row("i2", "ana", ["s2"], s),
      ]),
    ).toEqual(["s1", "s2"]);
  });
});

describe("buildBulkPaid", () => {
  it("marks every open installment paid in one call and sums the summary", () => {
    const s = [
      sched("s1"),
      sched("s2", {
        amount_paid: 400,
        remaining_amount: 600,
        status: "partial",
      }),
      sched("s3", { status: "paid", amount_paid: 1000, remaining_amount: 0 }),
    ];
    const rows = [
      row("i1", "ana", ["s1"], s),
      row("i2", "ben", ["s2", "s3"], s),
    ];
    const bulk = buildBulkPaid(rows, s, CUTOFF);
    expect(bulk.missing).toEqual([]);
    expect(bulk.plan.paidIds).toEqual(["s1", "s2"]);
    expect(bulk.plan.partials).toEqual([]);
    expect(bulk.plan.undoCalls).toEqual([]);
    expect(bulk.summary).toEqual({
      borrowers: 2,
      collections: 2,
      alreadyPaid: 1,
      total: 1600,
    });
    expect(bulk.tickIds).toEqual(["i1", "i2"]);
    expect(bulk.borrowerIds).toEqual(["b-ana", "b-ben"]);
    expect(bulk.accountIds).toEqual(["acc-s1", "acc-s2"]);
  });

  it("undo resets each installment and puts back an earlier part payment", () => {
    const s = [
      sched("s1", { due_date: "2026-10-15", status: "overdue" }),
      sched("s2", {
        due_date: "2026-10-25",
        amount_paid: 400,
        remaining_amount: 600,
        status: "partial",
      }),
    ];
    const bulk = buildBulkPaid([row("i1", "ana", ["s1", "s2"], s)], s, CUTOFF);
    const [t1, t2] = bulk.targets;
    expect(t1.reset.undoCalls).toEqual([
      { accountId: "acc-s1", scheduleId: "s1", status: "overdue" },
    ]);
    expect(t1.restore.payments).toEqual([]);
    expect(t1.restoreAmount).toBe(0);
    expect(t2.reset.undoCalls).toEqual([
      { accountId: "acc-s2", scheduleId: "s2", status: "pending" },
    ]);
    expect(t2.restore.partials).toEqual([{ id: "s2", amount: 400 }]);
    expect(t2.restoreAmount).toBe(400);
    expect(t2.itemIds).toEqual(["i1"]);
    expect(t2.name).toBe("ana");
    expect(t2.borrowerId).toBe("b-ana");
  });

  it("does not tick a row that is already ticked", () => {
    const s = [sched("s1")];
    const bulk = buildBulkPaid(
      [row("i1", "ana", ["s1"], s, { is_checked: true })],
      s,
      CUTOFF,
    );
    expect(bulk.plan.paidIds).toEqual(["s1"]);
    expect(bulk.tickIds).toEqual([]);
  });

  it("counts a schedule linked from two rows once and ticks both", () => {
    const s = [sched("s1")];
    const bulk = buildBulkPaid(
      [row("i1", "ana", ["s1"], s), row("i2", "ana", ["s1"], s)],
      s,
      CUTOFF,
    );
    expect(bulk.plan.paidIds).toEqual(["s1"]);
    expect(bulk.summary.collections).toBe(1);
    expect(bulk.summary.borrowers).toBe(1);
    expect(bulk.targets).toHaveLength(1);
    expect(bulk.targets[0].itemIds).toEqual(["i1", "i2"]);
    expect(bulk.tickIds).toEqual(["i1", "i2"]);
  });

  it("reports schedules it couldn't load", () => {
    const s = [sched("s1"), sched("s2")];
    const rows = [row("i1", "ana", ["s1", "s2"], s)];
    const bulk = buildBulkPaid(rows, [s[0]], CUTOFF);
    expect(bulk.missing).toEqual(["s2"]);
    // A row with an installment it can't see is never ticked.
    expect(bulk.tickIds).toEqual([]);
  });

  it("ticks a row the live rows show as paid already, writing no payment", () => {
    const cached = [sched("s1")];
    const live = [
      sched("s1", { status: "paid", amount_paid: 1000, remaining_amount: 0 }),
    ];
    const bulk = buildBulkPaid(
      [row("i1", "ana", ["s1"], cached)],
      live,
      CUTOFF,
    );
    expect(bulk.plan).toEqual({
      payments: [],
      paidIds: [],
      partials: [],
      undoCalls: [],
    });
    expect(bulk.targets).toEqual([]);
    expect(bulk.tickIds).toEqual(["i1"]);
    expect(bulk.summary).toEqual({
      borrowers: 1,
      collections: 0,
      alreadyPaid: 1,
      total: 0,
    });
  });

  it("ticks an all-paid unticked row beside rows it pays, paying only the open ones", () => {
    const s = [
      sched("s1"),
      sched("s2", { status: "paid", amount_paid: 1000, remaining_amount: 0 }),
      sched("s3", { status: "paid", amount_paid: 1000, remaining_amount: 0 }),
    ];
    const bulk = buildBulkPaid(
      [row("i1", "ana", ["s1"], s), row("i2", "ben", ["s2", "s3"], s)],
      s,
      CUTOFF,
    );
    expect(bulk.plan.paidIds).toEqual(["s1"]);
    expect(bulk.plan.payments).toEqual([{ scheduleId: "s1", amount: 1000 }]);
    expect(bulk.targets.map((t) => t.scheduleId)).toEqual(["s1"]);
    expect(bulk.tickIds).toEqual(["i1", "i2"]);
    // Only borrowers it pays need their pages refreshed.
    expect(bulk.borrowerIds).toEqual(["b-ana"]);
    expect(bulk.summary).toEqual({
      borrowers: 2,
      collections: 1,
      alreadyPaid: 2,
      total: 1000,
    });
  });

  it("pays the open installment of a row whose other one is paid", () => {
    const s = [
      sched("s1", { status: "paid", amount_paid: 1000, remaining_amount: 0 }),
      sched("s2", {
        amount_paid: 300,
        remaining_amount: 700,
        status: "partial",
      }),
    ];
    const bulk = buildBulkPaid([row("i1", "ana", ["s1", "s2"], s)], s, CUTOFF);
    expect(bulk.plan.paidIds).toEqual(["s2"]);
    expect(bulk.plan.payments).toEqual([{ scheduleId: "s2", amount: 700 }]);
    // Undo takes back only what this action paid.
    expect(bulk.targets).toHaveLength(1);
    expect(bulk.targets[0].scheduleId).toBe("s2");
    expect(bulk.targets[0].reset.undoCalls.map((c) => c.scheduleId)).toEqual([
      "s2",
    ]);
    expect(bulk.targets[0].restore.partials).toEqual([
      { id: "s2", amount: 300 },
    ]);
    expect(bulk.tickIds).toEqual(["i1"]);
    expect(bulk.summary).toEqual({
      borrowers: 1,
      collections: 1,
      alreadyPaid: 1,
      total: 700,
    });
  });

  it("keeps the total in centavos (no float noise)", () => {
    const s = [
      sched("s1", {
        amount_due: 113.37,
        amount_paid: 14.63,
        remaining_amount: 98.74,
        status: "partial",
      }),
      sched("s2", { amount_due: 0.1, remaining_amount: 0.1 }),
      sched("s3", { amount_due: 0.2, remaining_amount: 0.2 }),
    ];
    const bulk = buildBulkPaid(
      [row("i1", "ana", ["s1", "s2", "s3"], s)],
      s,
      CUTOFF,
    );
    expect(bulk.summary.total).toBe(99.04);
    expect(bulk.targets[0].restoreAmount).toBe(14.63);
    expect(bulk.targets[0].restore.partials).toEqual([
      { id: "s1", amount: 14.63 },
    ]);
  });
});

describe("bulkPayFailureText", () => {
  it("uses the default for one installment and says to check for several", () => {
    expect(bulkPayFailureText(1)).toBeUndefined();
    expect(bulkPayFailureText(3)).toBe(
      "Couldn't mark them all paid — check what is recorded",
    );
  });
});

describe("bulkUndoOutcome", () => {
  const s = [
    sched("s1"),
    sched("s2", { amount_paid: 400, remaining_amount: 600, status: "partial" }),
    sched("s3", {
      amount_paid: 250.5,
      remaining_amount: 749.5,
      status: "partial",
    }),
  ];
  const bulk = buildBulkPaid(
    [
      row("i1", "ana", ["s1"], s),
      row("i2", "ben", ["s2"], s),
      row("i3", "cy", ["s3"], s, { is_checked: true }),
    ],
    s,
    CUTOFF,
  );
  const [t1, t2, t3] = bulk.targets;
  const results = (...failed: (number | null)[]): BulkUndoResult[] =>
    [t1, t2, t3].map((target, i) => ({ target, failedAt: failed[i] }));

  it("unticks only what the pay ticked, and says nothing when all went through", () => {
    expect(bulk.tickIds).toEqual(["i1", "i2"]);
    expect(bulkUndoOutcome(results(null, null, null), bulk.tickIds)).toEqual({
      untickIds: ["i1", "i2"],
      errors: [],
      note: null,
    });
  });

  it("keeps the tick where the reset was refused and names who is still paid", () => {
    expect(bulkUndoOutcome(results(0, null, null), bulk.tickIds)).toEqual({
      untickIds: ["i2"],
      errors: ["Couldn't undo 1 of 3 collections — still recorded for ana"],
      note: null,
    });
  });

  it("says plainly when nothing was undone", () => {
    expect(bulkUndoOutcome(results(0, 0, 0), bulk.tickIds)).toEqual({
      untickIds: [],
      errors: ["Couldn't undo — the payments are still recorded"],
      note: null,
    });
  });

  it("reports earlier payments it couldn't put back, with the amount", () => {
    expect(
      bulkUndoOutcome(results(null, 1, null), bulk.tickIds).errors,
    ).toEqual([
      "Couldn't put back the earlier ₱400 payment for ben — re-enter it",
    ]);
    expect(bulkUndoOutcome(results(null, 1, 1), bulk.tickIds).errors).toEqual([
      "Couldn't put back 2 earlier payments (₱650.5) for ben, cy — re-enter them",
    ]);
  });

  it("uses the one-row Undo's words for a single installment", () => {
    expect(bulkUndoOutcome([{ target: t2, failedAt: 0 }], []).errors).toEqual([
      "Couldn't undo — the payment is still recorded",
    ]);
    expect(bulkUndoOutcome([{ target: t2, failedAt: 1 }], []).errors).toEqual([
      "Couldn't put back the earlier ₱400 payment — re-enter it",
    ]);
  });

  it("unticks rows it only ticked (nothing paid) and never other rows", () => {
    const paid = sched("p1", {
      status: "paid",
      amount_paid: 1000,
      remaining_amount: 0,
    });
    const open = sched("o1");
    const mixed = buildBulkPaid(
      [
        row("i1", "ana", ["o1"], [open]),
        row("i2", "ben", ["p1"], [paid]),
        row("i3", "cy", ["p1"], [paid], { is_checked: true }),
      ],
      [open, paid],
      CUTOFF,
    );
    // i3 is ticked already: not eligible, never in tickIds.
    expect(mixed.tickIds).toEqual(["i1", "i2"]);
    const ok = mixed.targets.map((target) => ({ target, failedAt: null }));
    expect(bulkUndoOutcome(ok, mixed.tickIds).untickIds.sort()).toEqual([
      "i1",
      "i2",
    ]);
    // Reset refused: i1 stays ticked (still paid); i2 had nothing paid.
    const refused = mixed.targets.map((target) => ({ target, failedAt: 0 }));
    expect(bulkUndoOutcome(refused, mixed.tickIds).untickIds).toEqual(["i2"]);
    // Only ticking (nothing to pay): Undo makes no calls and unticks them.
    const onlyTicks = buildBulkPaid(
      [row("i2", "ben", ["p1"], [paid])],
      [paid],
      CUTOFF,
    );
    expect(onlyTicks.targets).toEqual([]);
    expect(bulkUndoOutcome([], onlyTicks.tickIds)).toEqual({
      untickIds: ["i2"],
      errors: [],
      note: null,
    });
  });

  it("shortens a long list of names", () => {
    const many: BulkUndoResult[] = ["a", "b", "c", "d", "e"].map((name) => ({
      target: { ...t1, name },
      failedAt: 0,
    }));
    many.push({ target: t2, failedAt: null });
    expect(bulkUndoOutcome(many, []).errors).toEqual([
      "Couldn't undo 5 of 6 collections — still recorded for a, b, c and 2 more",
    ]);
  });

  it("keeps manual-account installments: their rows stay ticked, with a note", () => {
    const { undo, kept } = splitBulkUndo(
      [t1, t2, t3],
      (accountId) => accountId === "acc-s1",
    );
    expect(kept).toEqual([t1]);
    expect(undo).toEqual([t2, t3]);

    const out = bulkUndoOutcome(
      [
        { target: t2, failedAt: null },
        { target: t3, failedAt: null },
      ],
      bulk.tickIds,
      [t1],
    );
    // i1 (ana) is the kept one: not unticked, not "only ticked".
    expect(out.untickIds).toEqual(["i2"]);
    expect(out.errors).toEqual([]);
    expect(out.note).toBe(
      "1 payment kept for ana — manual accounts are changed on the account page",
    );
  });

  it("never unticks a row with a kept installment even if another reset went through", () => {
    const both = { ...t2, itemIds: ["i1"] };
    const out = bulkUndoOutcome([{ target: both, failedAt: null }], ["i1"], [
      t1,
    ]);
    expect(out.untickIds).toEqual([]);
  });
});

describe("splitBulkUndo", () => {
  it("sends held accounts' installments to kept", () => {
    const a = { accountId: "a" } as Parameters<typeof splitBulkUndo>[0][0];
    const b = { accountId: "b" } as Parameters<typeof splitBulkUndo>[0][0];
    expect(splitBulkUndo([a, b, a], (id) => id === "a")).toEqual({
      undo: [b],
      kept: [a, a],
    });
  });
});
