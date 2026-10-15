import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});

const { applyOfflinePayments, readCachedSchedules, readCachedSummaries } =
  await import("@/lib/checklist/schedule-cache");

const now = Date.now();
const row = (id: string, amount_due: number, amount_paid = 0) => ({
  id,
  account_id: "acc",
  due_date: "2026-10-15",
  amount_due,
  amount_paid,
  remaining_amount: amount_due - amount_paid,
  status: amount_paid > 0 ? "partial" : "pending",
  cachedAt: now,
});

beforeEach(() => {
  store.clear();
  store.set(
    "lendz-checklist-schedules",
    JSON.stringify({ s1: row("s1", 1000), s2: row("s2", 500, 200) }),
  );
  store.set(
    "lendz-checklist-account-summaries",
    JSON.stringify({
      acc: {
        typeLabel: "loan",
        isCashAdvance: false,
        paid: 2000,
        left: 8000,
        pct: 20,
        paidInstallments: 2,
        installmentCount: 10,
        cachedAt: now,
      },
    }),
  );
});

describe("applyOfflinePayments", () => {
  it("marks paid and partial rows and moves the account totals", () => {
    applyOfflinePayments([
      { scheduleId: "s1", amount: 1000 },
      { scheduleId: "s2", amount: 100 },
    ]);
    const [s1, s2] = readCachedSchedules(["s1", "s2"]);
    expect(s1).toMatchObject({
      status: "paid",
      amount_paid: 1000,
      remaining_amount: 0,
    });
    expect(s2).toMatchObject({
      status: "partial",
      amount_paid: 300,
      remaining_amount: 200,
    });
    expect(readCachedSummaries(["s1"])?.acc).toMatchObject({
      paid: 3100,
      left: 6900,
      pct: 31,
      paidInstallments: 3,
    });
  });

  it("caps a payment at what is still owed", () => {
    applyOfflinePayments([{ scheduleId: "s2", amount: 999 }]);
    expect(readCachedSchedules(["s2"])[0]).toMatchObject({
      status: "paid",
      amount_paid: 500,
    });
    expect(readCachedSummaries(["s2"])?.acc.paid).toBe(2300);
  });

  it("ignores schedules that are not cached", () => {
    applyOfflinePayments([{ scheduleId: "missing", amount: 50 }]);
    expect(readCachedSummaries(["s1"])?.acc.paid).toBe(2000);
  });
});
