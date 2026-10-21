import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBorrowerNextAmounts,
  mapBorrowerNextAmounts,
} from "@/lib/checklist/next-amounts";

const CUTOFF = "2026-10-20";

describe("mapBorrowerNextAmounts", () => {
  it("keeps only loan/cash_advance, drops bad items, sorts overdue first", () => {
    const data = {
      accounts: [
        { id: "a1", type: "loan" },
        { id: "a2", type: "cash_advance" },
        { id: "a3", type: "other" },
      ],
      metrics: {
        a1: {
          dueCollections: [
            { id: "s1", due_date: "2026-10-25T00:00:00", amount: 50 },
            { id: "s2", due_date: "2026-10-10", amount: 70 },
            { id: "s3", due_date: "2026-10-12", amount: 0 },
            { id: "s4", due_date: "", amount: 10 },
          ],
        },
        a2: {
          dueCollections: [{ id: "s5", due_date: "2026-10-25", amount: 20 }],
        },
        a3: { dueCollections: [{ id: "x", due_date: "2026-10-01", amount: 9 }] },
      },
    };
    const { items, manualAccounts } = mapBorrowerNextAmounts(data, CUTOFF);
    expect(manualAccounts).toEqual([]);
    expect(items.map((i) => i.id)).toEqual(["s2", "s5", "s1"]);
    expect(items[2]).toEqual({
      id: "s1",
      due_date: "2026-10-25",
      amount: 50,
      type: "loan",
    });
  });

  it("skips pending manual accounts and lists manual accounts with balance", () => {
    const data = {
      accounts: [
        { id: "m1", type: "loan", schedule_mode: "manual", status: "pending" },
        {
          id: "m2",
          type: "loan",
          schedule_mode: "manual",
          status: "active",
          release_date: "2026-09-01",
        },
        {
          id: "m3",
          type: "cash_advance",
          schedule_mode: "manual",
          status: "active",
          interest_type: "rolling",
          interest_rate: 5,
        },
        { id: "m4", type: "loan", schedule_mode: "manual", status: "active" },
      ],
      metrics: {
        m1: { amountLeftToPay: 100, dueCollections: [] },
        m2: { amountLeftToPay: 300, totalPaid: 50, dueCollections: [] },
        m3: {
          amountLeftToPay: 200,
          totalPaid: 10,
          dueCollections: [
            { id: "z", due_date: "2026-10-30", amount: 0 },
            { id: "r1", due_date: "2026-11-01T00:00", amount: 40 },
          ],
        },
        m4: { amountLeftToPay: 0, dueCollections: [] },
      },
    };
    const { items, manualAccounts } = mapBorrowerNextAmounts(data, CUTOFF);
    expect(manualAccounts).toEqual([
      {
        id: "m2",
        type: "loan",
        paid: 50,
        remaining: 300,
        release_date: "2026-09-01",
      },
      {
        id: "m3",
        type: "cash_advance",
        paid: 10,
        remaining: 200,
        release_date: null,
        rolling: {
          interestRate: 5,
          open: { id: "r1", due_date: "2026-11-01", amount: 40 },
        },
      },
    ]);
    expect(items).toEqual([
      { id: "r1", due_date: "2026-11-01", amount: 40, type: "cash_advance", manual: true },
    ]);
  });
});

describe("fetchBorrowerNextAmounts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns empty on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await fetchBorrowerNextAmounts("b")).toEqual({
      items: [],
      manualAccounts: [],
    });
  });

  it("returns empty when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("x"); }));
    expect(await fetchBorrowerNextAmounts("b")).toEqual({
      items: [],
      manualAccounts: [],
    });
  });
});
