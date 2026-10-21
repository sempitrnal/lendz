import { describe, expect, it } from "vitest";
import {
  needsStepGuard,
  refuseWhileSyncing,
  resetTookEffect,
  resetUnconfirmedMessage,
  STILL_SYNCING,
} from "@/lib/checklist/step-guard";
import type { PaymentPlan } from "@/lib/checklist/payment-plan";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";

const empty: PaymentPlan = {
  payments: [],
  paidIds: [],
  partials: [],
  undoCalls: [],
};
const pay: PaymentPlan = {
  ...empty,
  payments: [{ scheduleId: "s1", amount: 1000 }],
  paidIds: ["s1"],
};
const reset: PaymentPlan = {
  ...empty,
  undoCalls: [{ accountId: "a", scheduleId: "s1", status: "pending" }],
};
const partial: PaymentPlan = {
  ...empty,
  payments: [{ scheduleId: "s1", amount: 400 }],
  partials: [{ id: "s1", amount: 400 }],
};

const row = (over: Partial<ScheduleDialogRow> = {}): ScheduleDialogRow => ({
  id: "s1",
  account_id: "a",
  due_date: "2026-10-21",
  amount_due: 1000,
  amount_paid: 0,
  remaining_amount: 1000,
  status: "pending",
  ...over,
});

const peso = (n: number) => `₱${n.toLocaleString("en-US")}`;

describe("needsStepGuard", () => {
  it("guards resets and runs of more than one write", () => {
    expect(needsStepGuard([reset])).toBe(true);
    expect(needsStepGuard([reset, partial])).toBe(true);
    expect(needsStepGuard([pay, partial])).toBe(true);
    expect(needsStepGuard([reset, empty])).toBe(true);
  });
  it("leaves a plain pay alone", () => {
    expect(needsStepGuard([pay])).toBe(false);
    expect(needsStepGuard([pay, empty])).toBe(false);
    expect(needsStepGuard([empty])).toBe(false);
  });
});

describe("refuseWhileSyncing", () => {
  it("refuses only online with changes still waiting", () => {
    expect(refuseWhileSyncing({ connectionGood: true, pending: 1 })).toBe(true);
    expect(refuseWhileSyncing({ connectionGood: true, pending: 0 })).toBe(
      false,
    );
    // Offline the writes queue behind the waiting ones, in order.
    expect(refuseWhileSyncing({ connectionGood: false, pending: 3 })).toBe(
      false,
    );
    expect(refuseWhileSyncing({ connectionGood: false, pending: 0 })).toBe(
      false,
    );
  });
  it("says plainly to wait", () => {
    expect(STILL_SYNCING).toBe(
      "Still syncing offline changes — try again in a moment",
    );
  });
});

describe("resetTookEffect", () => {
  it("is confirmed when every row reads pending with nothing paid", () => {
    expect(resetTookEffect([row(), row({ id: "s2" })], ["s1", "s2"])).toEqual({
      ok: true,
      stillRecorded: 0,
    });
    expect(resetTookEffect([row({ status: "overdue" })], ["s1"]).ok).toBe(true);
  });

  it("ignores float noise below a centavo", () => {
    expect(
      resetTookEffect([row({ amount_paid: 0.000000001 })], ["s1"]),
    ).toEqual({ ok: true, stillRecorded: 0 });
    expect(resetTookEffect([row({ amount_paid: 0.004 })], ["s1"]).ok).toBe(
      true,
    );
  });

  it("is not confirmed when a row is still paid or part paid", () => {
    expect(
      resetTookEffect(
        [row({ status: "paid", amount_paid: 1000, remaining_amount: 0 })],
        ["s1"],
      ),
    ).toEqual({ ok: false, stillRecorded: 1000 });
    expect(
      resetTookEffect(
        [
          row({ status: "partial", amount_paid: 400.1 + 0.2 }),
          row({ id: "s2" }),
        ],
        ["s1", "s2"],
      ),
    ).toEqual({ ok: false, stillRecorded: 400.3 });
    // Paid with amount_paid 0 still counts the whole installment.
    expect(resetTookEffect([row({ status: "paid" })], ["s1"])).toEqual({
      ok: false,
      stillRecorded: 1000,
    });
  });

  it("can't confirm a row it didn't get back", () => {
    expect(resetTookEffect([], ["s1"])).toEqual({
      ok: false,
      stillRecorded: 0,
    });
  });
});

describe("resetUnconfirmedMessage", () => {
  it("says to check, with what is still recorded when known", () => {
    expect(resetUnconfirmedMessage(null, "undo", peso)).toBe(
      "Couldn't undo — check what is recorded on the account",
    );
    expect(resetUnconfirmedMessage(1400, "undo", peso)).toBe(
      "Couldn't undo — check what is recorded on the account (₱1,400 still recorded)",
    );
    expect(resetUnconfirmedMessage(0, "save", peso)).toBe(
      "Couldn't save the new amount — check what is recorded on the account",
    );
  });
});
