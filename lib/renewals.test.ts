import { describe, expect, it } from "vitest";
import {
  buildRenewals,
  renewalAccount,
  renewalWindow,
  type RenewalAccountInput,
  type RenewalSchedule,
} from "@/lib/renewals";

const account = (
  over: Partial<RenewalAccountInput> = {},
): RenewalAccountInput => ({
  id: "a1",
  borrower_id: "b1",
  principal_amount: 10000,
  type: "loan",
  payment_frequency: "bimonthly",
  term_months: 10,
  ...over,
});

/** `paid` installments paid, then the rest open, half a month apart. */
function schedules(
  total: number,
  paid: number,
  over: (i: number) => Partial<RenewalSchedule> = () => ({}),
  accountId = "a1",
): RenewalSchedule[] {
  return Array.from({ length: total }, (_, i) => {
    const month = String(1 + Math.floor(i / 2)).padStart(2, "0");
    const day = i % 2 === 0 ? "08" : "23";
    return {
      id: `${accountId}-s${i}`,
      account_id: accountId,
      due_date: `2027-${month}-${day}`,
      amount_due: 665,
      amount_paid: i < paid ? 665 : 0,
      remaining_amount: null,
      status: i < paid ? "paid" : "pending",
      ...over(i),
    };
  });
}

describe("renewalWindow", () => {
  it("is 3 months of installments for each frequency", () => {
    expect(
      renewalWindow({ payment_frequency: "bimonthly", term_months: 10 }),
    ).toBe(6);
    expect(
      renewalWindow({ payment_frequency: "monthly", term_months: 10 }),
    ).toBe(3);
    expect(renewalWindow({ payment_frequency: "weekly", term_months: 3 })).toBe(
      12,
    );
  });
  it("works out a custom schedule from its term and installments", () => {
    // 6 months over 12 installments: half a month each, like bimonthly.
    expect(
      renewalWindow({
        payment_frequency: "custom",
        term_months: 6,
        term_installments: 12,
      }),
    ).toBe(6);
  });
});

describe("renewalAccount", () => {
  it("qualifies with 6 bimonthly installments left", () => {
    const result = renewalAccount(
      account(),
      schedules(20, 14),
      [],
      "2027-01-01",
    );
    expect(result?.left).toBe(6);
    expect(result?.monthsLeft).toBe(3);
    expect(result?.balance).toBe(6 * 665);
  });
  it("does not qualify with 7 left", () => {
    expect(
      renewalAccount(account(), schedules(20, 13), [], "2027-01-01"),
    ).toBeNull();
  });
  it("leaves out finished accounts", () => {
    expect(
      renewalAccount(account(), schedules(20, 20), [], "2027-01-01"),
    ).toBeNull();
  });
  it("lists partials with their last payment and counts their unpaid part", () => {
    const rows = schedules(20, 16, (i) =>
      i === 16 ? { amount_paid: 480, status: "partial" } : {},
    );
    const result = renewalAccount(
      account(),
      rows,
      [
        { schedule_id: "a1-s16", payment_date: "2027-08-20" },
        { schedule_id: "a1-s15", payment_date: "2027-08-08" },
      ],
      "2027-01-01",
    );
    expect(result?.partials).toEqual([
      {
        scheduleId: "a1-s16",
        dueDate: rows[16].due_date,
        paid: 480,
        due: 665,
        lastPaid: "2027-08-20",
      },
    ]);
    expect(result?.balance).toBe(185 + 3 * 665);
    expect(result?.lastPaid).toBe("2027-08-20");
  });
  it("counts open installments due before today as overdue", () => {
    const result = renewalAccount(
      account(),
      schedules(20, 16),
      [],
      "2027-09-01",
    );
    // Open: s16 (sep 08), s17 (sep 23), s18, s19 — none before sep 1.
    expect(result?.overdue).toBe(0);
    const late = renewalAccount(account(), schedules(20, 16), [], "2027-09-30");
    expect(late?.overdue).toBe(2);
  });
});

describe("short accounts", () => {
  it("a 4-installment account qualifies only with 2 or 1 left", () => {
    expect(
      renewalAccount(account(), schedules(4, 1), [], "2027-01-01"),
    ).toBeNull();
    expect(
      renewalAccount(account(), schedules(4, 2), [], "2027-01-01")?.left,
    ).toBe(2);
    expect(
      renewalAccount(account(), schedules(4, 3), [], "2027-01-01")?.left,
    ).toBe(1);
  });
});

describe("3-month accounts", () => {
  it("a 6-installment account qualifies only with 2 or 1 left", () => {
    expect(
      renewalAccount(account(), schedules(6, 3), [], "2027-01-01"),
    ).toBeNull();
    expect(
      renewalAccount(account(), schedules(6, 4), [], "2027-01-01")?.left,
    ).toBe(2);
  });
});

describe("buildRenewals", () => {
  it("groups borrowers by category, closest to the end first", () => {
    const groups = buildRenewals({
      borrowers: [
        {
          id: "b1",
          name: "ana",
          category: { name: "rose", color: "#f00", order: 1 },
        },
        {
          id: "b2",
          name: "ben",
          category: { name: "rose", color: "#f00", order: 1 },
        },
        { id: "b3", name: "cy", category: null },
      ],
      accounts: [
        account({ id: "a1", borrower_id: "b1" }),
        account({ id: "a2", borrower_id: "b2" }),
        account({ id: "a3", borrower_id: "b3" }),
      ],
      schedules: [
        ...schedules(20, 14, undefined, "a1"),
        ...schedules(20, 18, undefined, "a2"),
        ...schedules(20, 17, undefined, "a3"),
      ],
      payments: [],
      today: "2027-01-01",
    });
    expect(groups.map((g) => g.name)).toEqual(["rose", "uncategorized"]);
    expect(groups[0].borrowers.map((b) => b.name)).toEqual(["ben", "ana"]);
    expect(groups[0].balance).toBe(8 * 665);
  });
});
