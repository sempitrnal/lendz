import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/schedules", () => ({
  addManualScheduleAction: vi.fn(),
  applyPartialPaymentAction: vi.fn(),
}));

import {
  addManualScheduleAction,
  applyPartialPaymentAction,
} from "@/lib/actions/schedules";
import { recordManualPayment } from "@/lib/checklist/manual-payment";
import type { ManualAccount } from "@/lib/checklist/labels";

const add = vi.mocked(addManualScheduleAction);
const apply = vi.mocked(applyPartialPaymentAction);

const flat: ManualAccount = {
  id: "a1",
  type: "loan",
  paid: 0,
  remaining: 3000,
  release_date: null,
};
const rolling: ManualAccount = {
  ...flat,
  rolling: {
    interestRate: 10,
    open: { id: "s1", due_date: "2026-10-20", amount: 2000 },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recordManualPayment", () => {
  it("pays the open schedule of a rolling account", async () => {
    const res = await recordManualPayment({
      account: rolling,
      amount: 500,
      paidDate: "2026-10-21",
    });
    expect(apply).toHaveBeenCalledTimes(1);
    const fd = apply.mock.calls[0][0];
    expect(fd.get("scheduleId")).toBe("s1");
    expect(fd.get("paymentAmount")).toBe("500");
    expect(fd.get("paymentDate")).toBe("2026-10-21");
    expect(add).not.toHaveBeenCalled();
    expect(res).toEqual({
      ok: true,
      schedule: { id: "s1", due_date: "2026-10-20", amount: 500, type: "loan" },
      rolloverAmount: 1500,
    });
  });

  it("adds a paid schedule for a flat account", async () => {
    add.mockResolvedValue({ id: "new1" });
    const res = await recordManualPayment({
      account: flat,
      amount: 500,
      paidDate: "2026-10-21",
    });
    expect(add).toHaveBeenCalledWith("a1", {
      due_date: "2026-10-21",
      amount_due: 500,
      status: "paid",
      paid_date: "2026-10-21",
    });
    expect(res).toEqual({
      ok: true,
      schedule: {
        id: "new1",
        due_date: "2026-10-21",
        amount: 500,
        type: "loan",
      },
      rolloverAmount: 0,
    });
  });

  it("returns the action's error when a flat add gives no id", async () => {
    add.mockResolvedValue({ error: "nope" });
    expect(
      await recordManualPayment({ account: flat, amount: 5, paidDate: "d" }),
    ).toEqual({ ok: false, error: "nope" });
  });

  it("falls back to the offline message", async () => {
    add.mockResolvedValue({});
    expect(
      await recordManualPayment({ account: flat, amount: 5, paidDate: "d" }),
    ).toEqual({
      ok: false,
      error: "Couldn't add the payment (offline?)",
      unknown: true,
    });
  });

  it("returns a generic error, outcome unknown, when an action throws", async () => {
    add.mockRejectedValue(new Error("boom"));
    expect(
      await recordManualPayment({ account: flat, amount: 5, paidDate: "d" }),
    ).toEqual({ ok: false, error: "Couldn't add the payment", unknown: true });
    apply.mockRejectedValue(new Error("boom"));
    expect(
      await recordManualPayment({ account: rolling, amount: 5, paidDate: "d" }),
    ).toEqual({ ok: false, error: "Couldn't add the payment", unknown: true });
  });
});
