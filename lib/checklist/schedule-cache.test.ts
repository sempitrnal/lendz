import { beforeEach, describe, expect, it, vi } from "vitest";

/** What the mocked Supabase returns per table; `in` resolves the query. */
const tables: Record<string, unknown[]> = {};
const queried: string[] = [];
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const builder = {
        select: () => builder,
        in: () => {
          queried.push(table);
          return Promise.resolve({ data: tables[table] ?? [], error: null });
        },
      };
      return builder;
    },
  },
}));

let pendingOutbox = 0;
vi.mock("@/lib/offline/outbox", () => ({
  getPendingOutboxCount: async () => pendingOutbox,
}));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});

const {
  applyPaymentsToCache,
  readCachedSchedules,
  readCachedSummaries,
  refreshCachedAccounts,
  undoPaymentsInCache,
} = await import("@/lib/checklist/schedule-cache");

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
  queried.length = 0;
  pendingOutbox = 0;
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

describe("applyPaymentsToCache", () => {
  it("marks paid and partial rows and moves the account totals", () => {
    applyPaymentsToCache([
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
    applyPaymentsToCache([{ scheduleId: "s2", amount: 999 }]);
    expect(readCachedSchedules(["s2"])[0]).toMatchObject({
      status: "paid",
      amount_paid: 500,
    });
    expect(readCachedSummaries(["s2"])?.acc.paid).toBe(2300);
  });

  it("ignores schedules that are not cached", () => {
    applyPaymentsToCache([{ scheduleId: "missing", amount: 50 }]);
    expect(readCachedSummaries(["s1"])?.acc.paid).toBe(2000);
  });
});

describe("refreshCachedAccounts", () => {
  const live = (paid: number) => {
    // s1 now paid on the server, s2 deleted there.
    tables.payment_schedules = [
      {
        ...row("s1", 1000),
        amount_paid: paid,
        remaining_amount: 1000 - paid,
        status: "paid",
      },
    ];
    tables.accounts = [
      {
        id: "acc",
        type: "loan",
        schedule_mode: "auto",
        interest_type: null,
        principal_amount: 1000,
        interest_rate: 0,
        payment_schedules: [
          {
            amount_due: 1000,
            amount_paid: paid,
            remaining_amount: 1000 - paid,
            status: "paid",
          },
        ],
      },
    ];
  };

  it("re-downloads a changed account and drops deleted schedules", async () => {
    live(1000);
    await refreshCachedAccounts(["acc"]);
    expect(readCachedSchedules(["s1", "s2"])).toEqual([
      expect.objectContaining({ id: "s1", status: "paid", amount_paid: 1000 }),
    ]);
    expect(readCachedSummaries(["s1"])?.acc).toMatchObject({
      paid: 1000,
      left: 0,
    });
  });

  it("finds the account from a cached schedule id (delete events)", async () => {
    live(1000);
    await refreshCachedAccounts([], ["s2"]);
    expect(queried).toContain("payment_schedules");
    expect(readCachedSchedules(["s2"])).toEqual([]);
  });

  it("skips accounts the device hasn't saved", async () => {
    await refreshCachedAccounts(["other"]);
    expect(queried).toEqual([]);
  });

  it("waits while offline edits are queued", async () => {
    pendingOutbox = 1;
    live(1000);
    await refreshCachedAccounts(["acc"]);
    expect(queried).toEqual([]);
    expect(readCachedSchedules(["s2"])).toHaveLength(1);
  });
});

describe("undoPaymentsInCache", () => {
  it("resets paid and partial schedules and takes their payments back off", () => {
    applyPaymentsToCache([{ scheduleId: "s1", amount: 1000 }]);
    // s1 now paid (1000), s2 partial (200 of 500); account 3000 paid, 3 inst.
    undoPaymentsInCache(["s1", "s2"]);
    const [s1, s2] = readCachedSchedules(["s1", "s2"]);
    expect(s1).toMatchObject({ amount_paid: 0, remaining_amount: 1000 });
    expect(s2).toMatchObject({ amount_paid: 0, remaining_amount: 500 });
    expect(["pending", "overdue"]).toContain(s1.status);
    expect(readCachedSummaries(["s1"])?.acc).toMatchObject({
      paid: 1800,
      left: 8200,
      paidInstallments: 2,
    });
  });

  it("leaves schedules with nothing paid alone", () => {
    applyPaymentsToCache([]);
    undoPaymentsInCache(["missing"]);
    expect(readCachedSummaries(["s1"])?.acc.paid).toBe(2000);
  });
});
