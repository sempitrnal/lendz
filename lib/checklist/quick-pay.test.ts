import { describe, expect, it } from "vitest";
import { buildQuickPay } from "@/lib/checklist/quick-pay";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";

const CUTOFF = "2026-10-20";

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

describe("buildQuickPay", () => {
  it("pays what is left of an unpaid installment and settles the row", () => {
    const q = buildQuickPay(
      [{ id: "s1", state: "unpaid" }],
      ["s1"],
      [sched()],
      CUTOFF,
    );
    expect(q).not.toBeNull();
    expect(q!.pay.paidIds).toEqual(["s1"]);
    expect(q!.pay.payments).toEqual([{ scheduleId: "s1", amount: 2000 }]);
    expect(q!.amount).toBe(2000);
    expect(q!.settlesRow).toBe(true);
    expect(q!.accountIds).toEqual(["a1"]);
    expect(q!.undo.undoCalls).toEqual([
      { accountId: "a1", scheduleId: "s1", status: "overdue" },
    ]);
    expect(q!.undo.payments).toEqual([]);
    expect(q!.restore.payments).toEqual([]);
  });

  it("undo resets a not-yet-due installment to pending", () => {
    const q = buildQuickPay(
      [{ id: "s1", state: "unpaid" }],
      ["s1"],
      [sched({ due_date: "2026-10-25", status: "pending" })],
      CUTOFF,
    );
    expect(q!.undo.undoCalls[0].status).toBe("pending");
  });

  it("pays only the rest of a part-paid installment and restores the part on undo", () => {
    const q = buildQuickPay(
      [{ id: "s1", state: "partial" }],
      ["s1"],
      [
        sched({
          amount_paid: 400,
          remaining_amount: 1600,
          status: "partial",
        }),
      ],
      CUTOFF,
    );
    expect(q!.amount).toBe(1600);
    expect(q!.pay.payments).toEqual([{ scheduleId: "s1", amount: 1600 }]);
    expect(q!.restore.partials).toEqual([{ id: "s1", amount: 400 }]);
    expect(q!.restore.payments).toEqual([{ scheduleId: "s1", amount: 400 }]);
    expect(q!.restore.paidIds).toEqual([]);
    expect(q!.restore.undoCalls).toEqual([]);
  });

  it("does not settle the row while another installment is open", () => {
    const q = buildQuickPay(
      [
        { id: "s1", state: "unpaid" },
        { id: "s2", state: "unpaid" },
      ],
      ["s1"],
      [sched(), sched({ id: "s2" })],
      CUTOFF,
    );
    expect(q!.pay.paidIds).toEqual(["s1"]);
    expect(q!.settlesRow).toBe(false);
  });

  it("settles the row when the other installments are already paid", () => {
    const q = buildQuickPay(
      [
        { id: "s1", state: "unpaid" },
        { id: "s2", state: "paid" },
      ],
      ["s1"],
      [sched()],
      CUTOFF,
    );
    expect(q!.settlesRow).toBe(true);
  });

  it("pays several installments across accounts", () => {
    const q = buildQuickPay(
      [
        { id: "s1", state: "unpaid" },
        { id: "s2", state: "unpaid" },
      ],
      ["s1", "s2"],
      [
        sched(),
        sched({
          id: "s2",
          account_id: "a2",
          amount_due: 500.5,
          remaining_amount: 500.5,
        }),
      ],
      CUTOFF,
    );
    expect(q!.amount).toBe(2500.5);
    expect(q!.accountIds).toEqual(["a1", "a2"]);
    expect(q!.undo.undoCalls.map((c) => c.scheduleId)).toEqual(["s1", "s2"]);
  });

  it("returns null when a schedule is not loaded", () => {
    expect(
      buildQuickPay([{ id: "s1", state: "unpaid" }], ["s1"], [], CUTOFF),
    ).toBeNull();
  });

  it("returns null when everything targeted is already paid", () => {
    expect(
      buildQuickPay(
        [{ id: "s1", state: "paid" }],
        ["s1"],
        [sched({ status: "paid", amount_paid: 2000, remaining_amount: 0 })],
        CUTOFF,
      ),
    ).toBeNull();
  });

  it("does not undo an already paid installment among the targets", () => {
    const q = buildQuickPay(
      [
        { id: "s1", state: "unpaid" },
        { id: "s2", state: "paid" },
      ],
      ["s1", "s2"],
      [
        sched(),
        sched({
          id: "s2",
          status: "paid",
          amount_paid: 2000,
          remaining_amount: 0,
        }),
      ],
      CUTOFF,
    );
    expect(q!.pay.paidIds).toEqual(["s1"]);
    expect(q!.undo.undoCalls.map((c) => c.scheduleId)).toEqual(["s1"]);
  });

  it("returns null with no targets", () => {
    expect(buildQuickPay([], [], [sched()], CUTOFF)).toBeNull();
  });

  describe("amounts come from the rows passed in (live), not the row view", () => {
    it("restores a part payment the row view didn't know about", () => {
      // Cached state said unpaid; the live row has ₱400 recorded elsewhere.
      const q = buildQuickPay(
        [{ id: "s1", state: "unpaid" }],
        ["s1"],
        [
          sched({
            amount_paid: 400,
            remaining_amount: 1600,
            status: "partial",
          }),
        ],
        CUTOFF,
      );
      expect(q!.amount).toBe(1600);
      expect(q!.restore.partials).toEqual([{ id: "s1", amount: 400 }]);
    });

    it("restores nothing when the part payment was removed elsewhere", () => {
      // Cached state said part-paid; the live row has nothing recorded.
      const q = buildQuickPay(
        [{ id: "s1", state: "partial" }],
        ["s1"],
        [sched()],
        CUTOFF,
      );
      expect(q!.amount).toBe(2000);
      expect(q!.restore.payments).toEqual([]);
      expect(q!.restore.partials).toEqual([]);
    });

    it("settles the row when another line is paid in the live rows", () => {
      const q = buildQuickPay(
        [
          { id: "s1", state: "unpaid" },
          { id: "s2", state: "unpaid" },
        ],
        ["s1"],
        [
          sched(),
          sched({
            id: "s2",
            status: "paid",
            amount_paid: 2000,
            remaining_amount: 0,
          }),
        ],
        CUTOFF,
      );
      expect(q!.settlesRow).toBe(true);
    });

    it("does not settle when the live rows show another line reopened", () => {
      const q = buildQuickPay(
        [
          { id: "s1", state: "unpaid" },
          { id: "s2", state: "paid" },
        ],
        ["s1"],
        [sched(), sched({ id: "s2" })],
        CUTOFF,
      );
      expect(q!.settlesRow).toBe(false);
    });
  });
});
