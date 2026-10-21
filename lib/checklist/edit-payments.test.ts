import { describe, expect, it } from "vitest";
import {
  buildEditPlan,
  canSaveEdit,
  cardTarget,
  editButtonLabel,
  editFailureMessages,
  editUndoFailureMessages,
  recordedCards,
} from "@/lib/checklist/edit-payments";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";

const CUTOFF = "2026-10-20";
const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function sched(over: Partial<ScheduleDialogRow> = {}): ScheduleDialogRow {
  return {
    id: "s1",
    account_id: "a1",
    due_date: "2026-10-15",
    amount_due: 2000,
    amount_paid: 0,
    remaining_amount: 2000,
    status: "overdue",
    ...over,
  };
}

const paid = sched({
  id: "p",
  status: "paid",
  amount_paid: 2000,
  remaining_amount: 0,
});
const part = sched({
  id: "q",
  account_id: "a2",
  status: "partial",
  amount_paid: 400,
  remaining_amount: 1600,
});
const open = sched({ id: "o" });
const cards = recordedCards([open, part, paid], ["p", "q", "o"]);

describe("recordedCards", () => {
  it("keeps installments with money recorded, in label order", () => {
    expect(cards.map((c) => [c.row.id, c.recorded, c.due])).toEqual([
      ["p", 2000, 2000],
      ["q", 400, 2000],
    ]);
  });
});

describe("cardTarget", () => {
  it("clamps to 0..due and rejects unreadable amounts", () => {
    expect(cardTarget(cards[1], "5,000")).toBe(2000);
    expect(cardTarget(cards[1], "0")).toBe(0);
    expect(cardTarget(cards[1], "1,5")).toBeNull();
    expect(cardTarget(cards[1], "")).toBeNull();
  });
});

describe("buildEditPlan", () => {
  it("is unchanged until an amount differs", () => {
    const e = buildEditPlan(cards, { p: "2000", q: "400" }, CUTOFF);
    expect(e.changed).toBe(false);
    expect(canSaveEdit(e)).toBe(false);
    expect(editButtonLabel(e, peso)).toBe("Change an amount to save");
    expect(e.total).toBe(2400);
  });

  it("lowers an amount: reset first, then the new amount", () => {
    const e = buildEditPlan(cards, { p: "1,500", q: "400" }, CUTOFF);
    expect(e.changed).toBe(true);
    expect(e.first.undoCalls).toEqual([
      { accountId: "a1", scheduleId: "p", status: "overdue" },
    ]);
    expect(e.first.payments).toEqual([]);
    expect(e.then.partials).toEqual([{ id: "p", amount: 1500 }]);
    expect(e.then.undoCalls).toEqual([]);
    expect(e.removed).toBe(2000);
    expect(e.readded).toBe(1500);
    expect(e.total).toBe(1900);
    expect(editButtonLabel(e, peso)).toBe("Save · ₱1,900 paid");
    expect(e.accountIds).toEqual(["a1"]);
    // Undo resets it again and puts the whole installment back.
    expect(e.undo.reset.undoCalls.map((c) => c.scheduleId)).toEqual(["p"]);
    expect(e.undo.restore.paidIds).toEqual(["p"]);
  });

  it("raises an amount by adding the difference, paid when it reaches the whole", () => {
    const more = buildEditPlan(cards, { p: "2000", q: "1000" }, CUTOFF);
    expect(more.first.partials).toEqual([{ id: "q", amount: 600 }]);
    expect(more.first.undoCalls).toEqual([]);
    expect(more.then.payments).toEqual([]);
    expect(more.undo.restore.partials).toEqual([{ id: "q", amount: 400 }]);

    const full = buildEditPlan(cards, { p: "2000", q: "2000" }, CUTOFF);
    expect(full.first.paidIds).toEqual(["q"]);
    expect(full.first.payments).toEqual([{ scheduleId: "q", amount: 1600 }]);
  });

  it("not paid on everything reads Remove payment and only resets", () => {
    const e = buildEditPlan(cards, { p: "0", q: "0" }, CUTOFF);
    expect(e.removesAll).toBe(true);
    expect(editButtonLabel(e, peso)).toBe("Remove payment");
    expect(e.first.undoCalls.map((c) => c.scheduleId)).toEqual(["p", "q"]);
    expect(e.then.payments).toEqual([]);
    expect(e.readded).toBe(0);
    expect(e.undo.restore.paidIds).toEqual(["p"]);
    expect(e.undo.restore.partials).toEqual([{ id: "q", amount: 400 }]);
  });

  it("blocks saving while an amount is unreadable", () => {
    const e = buildEditPlan(cards, { p: "1,5", q: "0" }, CUTOFF);
    expect(e.valid).toBe(false);
    expect(e.removesAll).toBe(false);
    expect(canSaveEdit(e)).toBe(false);
    expect(editButtonLabel(e, peso)).toBe("Check the amounts");
  });

  it("raising a paid installment recorded short resets it, since nothing can be added", () => {
    const short = recordedCards(
      [
        sched({
          id: "r",
          status: "paid",
          amount_paid: 1500,
          remaining_amount: 0,
        }),
      ],
      ["r"],
    );
    const e = buildEditPlan(short, { r: "2000" }, CUTOFF);
    expect(e.first.undoCalls.map((c) => c.scheduleId)).toEqual(["r"]);
    expect(e.then.paidIds).toEqual(["r"]);
  });
});

describe("failure messages", () => {
  it("say what happened to the money", () => {
    const one = buildEditPlan(cards, { p: "1500", q: "400" }, CUTOFF);
    const m = editFailureMessages(one, peso);
    expect(m.first).toBe("Couldn't save the changes — nothing was changed");
    expect(m.then).toBe(
      "The earlier ₱2,000 was removed but the new ₱1,500 couldn't be recorded — re-enter ₱1,500",
    );
    const both = buildEditPlan(cards, { p: "1500", q: "100" }, CUTOFF);
    expect(editFailureMessages(both, peso).first).toMatch(
      /check the recorded payments/,
    );
    expect(editUndoFailureMessages(one, peso)).toEqual({
      reset: "Couldn't undo — the change is still saved",
      restore: "Couldn't put back the earlier ₱2,000 — re-enter it",
    });
  });
});

describe("buildEditPlan with float noise", () => {
  const noisy = recordedCards(
    [
      sched({
        id: "n",
        amount_due: 113.37,
        amount_paid: 14.63,
        remaining_amount: 113.37 - 14.63,
        status: "partial",
      }),
    ],
    ["n"],
  );

  it("Paid in full (the due as shown) is a paid choice", () => {
    const e = buildEditPlan(noisy, { n: String(noisy[0].due) }, CUTOFF);
    expect(e.first.paidIds).toEqual(["n"]);
    expect(e.first.partials).toEqual([]);
  });

  it("the recorded amount as shown is unchanged", () => {
    expect(buildEditPlan(noisy, { n: "14.63" }, CUTOFF).changed).toBe(false);
  });
});
