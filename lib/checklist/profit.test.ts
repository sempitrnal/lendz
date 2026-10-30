import { describe, expect, it } from "vitest";
import {
  paidProfit,
  installmentProfit,
  principalShare,
  profitGained,
  profitOnInstallment,
  dayProfit,
  monthProfit,
  totalProfit,
} from "@/lib/checklist/profit";

describe("principalShare", () => {
  it("is the principal split over the installments", () => {
    expect(
      principalShare({
        principal_amount: 12000,
        term_months: 12,
        payment_frequency: "monthly",
      }),
    ).toBe(1000);
  });
  it("counts 4 installments a month weekly and 2 bimonthly", () => {
    expect(
      principalShare({
        principal_amount: 12000,
        term_months: 3,
        payment_frequency: "weekly",
      }),
    ).toBe(1000);
    expect(
      principalShare({
        principal_amount: 12000,
        term_months: 6,
        payment_frequency: "bimonthly",
      }),
    ).toBe(1000);
  });
  it("treats a missing term as one installment and a missing frequency as monthly", () => {
    expect(
      principalShare({
        principal_amount: 5000,
        term_months: null,
        payment_frequency: null,
      }),
    ).toBe(5000);
  });
  it("is 0 with no account or no principal", () => {
    expect(principalShare(null)).toBe(0);
    expect(
      principalShare({
        principal_amount: null,
        term_months: 6,
        payment_frequency: "monthly",
      }),
    ).toBe(0);
  });
});

describe("profitOnInstallment", () => {
  it("is what was paid beyond the principal share", () => {
    expect(profitOnInstallment(2450, 2000)).toBe(450);
  });
  it("is 0 while only principal has been paid", () => {
    expect(profitOnInstallment(1500, 2000)).toBe(0);
    expect(profitOnInstallment(0, 2000)).toBe(0);
  });
  it("rounds to centavos", () => {
    expect(profitOnInstallment(100.119, 33.3333)).toBe(66.79);
  });
});

describe("principalShare for custom and manual schedules", () => {
  it("uses the installment count of a custom schedule", () => {
    expect(
      principalShare({
        principal_amount: 9000,
        term_months: 3,
        payment_frequency: "custom",
        term_installments: 6,
      }),
    ).toBe(1500);
  });
  it("uses the installment count of a manual account, else its term", () => {
    expect(
      principalShare({
        principal_amount: 9000,
        term_months: 3,
        payment_frequency: null,
        schedule_mode: "manual",
        term_installments: 9,
      }),
    ).toBe(1000);
    expect(
      principalShare({
        principal_amount: 9000,
        term_months: 3,
        payment_frequency: null,
        schedule_mode: "manual",
      }),
    ).toBe(3000);
  });
});

describe("installmentProfit", () => {
  it("is what the installment earns once paid: its amount minus the principal share", () => {
    expect(installmentProfit(2450, 2000)).toBe(450);
  });
  it("is 0 when the amount does not exceed the share", () => {
    expect(installmentProfit(1800, 2000)).toBe(0);
  });
  it("rounds to centavos", () => {
    expect(installmentProfit(100.119, 33.3333)).toBe(66.79);
  });
});

describe("profitGained", () => {
  const rows = new Map([
    ["a", { amount_paid: 0, principal_share: 2000 }],
    ["b", { amount_paid: 1500, principal_share: 2000 }],
    ["c", { amount_paid: 2200, principal_share: 2000 }],
    ["d", { amount_paid: 0 }],
  ]);
  it("is the profit a payment adds beyond the principal share", () => {
    expect(profitGained([{ scheduleId: "a", amount: 2450 }], rows)).toBe(450);
  });
  it("counts only the part past the principal share on a part-paid schedule", () => {
    // 1500 paid of a 2000 share: paying 950 more reaches 2450, so 450 profit.
    expect(profitGained([{ scheduleId: "b", amount: 950 }], rows)).toBe(450);
    // Still under the share: nothing gained yet.
    expect(profitGained([{ scheduleId: "b", amount: 400 }], rows)).toBe(0);
  });
  it("counts only the new profit when profit was already collected", () => {
    expect(profitGained([{ scheduleId: "c", amount: 250 }], rows)).toBe(250);
  });
  it("adds up several schedules and skips unknown ones", () => {
    expect(
      profitGained(
        [
          { scheduleId: "a", amount: 2450 },
          { scheduleId: "c", amount: 250 },
          { scheduleId: "d", amount: 999 },
          { scheduleId: "zzz", amount: 100 },
        ],
        rows,
      ),
    ).toBe(700);
  });
  it("is 0 for no payments", () => {
    expect(profitGained([], rows)).toBe(0);
  });
});

describe("totalProfit", () => {
  it("adds what the schedules earn, skipping unknown ones", () => {
    expect(totalProfit([600, null, 400.5])).toBe(1000.5);
  });
  it("is null when none is known", () => {
    expect(totalProfit([null, null])).toBeNull();
    expect(totalProfit([])).toBeNull();
  });
});

describe("monthProfit", () => {
  const monthly = {
    principal_amount: 10000,
    term_months: 5,
    payment_frequency: "monthly",
  };
  it("adds each schedule's paid amount beyond its principal share", () => {
    // Share is 2,000: 2,600 earns 600; 1,500 earns nothing; unpaid earns nothing.
    expect(
      monthProfit([
        { amount_paid: 2600, accounts: monthly },
        { amount_paid: 1500, accounts: monthly },
        { amount_paid: 0, accounts: monthly },
      ]),
    ).toBe(600);
  });
  it("accepts the account as a one-item list, and skips a missing one", () => {
    expect(
      monthProfit([
        { amount_paid: 2500, accounts: [monthly] },
        { amount_paid: 2500, accounts: null },
      ]),
    ).toBe(500);
  });
});

describe("dayProfit", () => {
  const share = new Map([["s1", 800]]);

  it("counts the profit a payment adds beyond the principal share", () => {
    expect(
      dayProfit([{ scheduleId: "s1", amount: 1000 }], new Map(), share),
    ).toBe(200);
  });

  it("counts a partial under the principal share as no profit that day", () => {
    expect(
      dayProfit([{ scheduleId: "s1", amount: 500 }], new Map(), share),
    ).toBe(0);
  });

  it("counts the profit of the payment that crosses the share on its own day", () => {
    // 500 was paid on an earlier day; today's 500 takes it to 1000: 200 profit.
    expect(
      dayProfit(
        [{ scheduleId: "s1", amount: 500 }],
        new Map([["s1", 500]]),
        share,
      ),
    ).toBe(200);
  });

  it("counts nothing for a schedule already past its share before today's payment only for the new amount", () => {
    // 1000 paid earlier (200 profit already counted then); 100 more is 100 profit.
    expect(
      dayProfit(
        [{ scheduleId: "s1", amount: 100 }],
        new Map([["s1", 1000]]),
        share,
      ),
    ).toBe(100);
  });

  it("runs several payments to one schedule in order and adds schedules together", () => {
    const shares = new Map([
      ["s1", 800],
      ["s2", 100],
    ]);
    expect(
      dayProfit(
        [
          { scheduleId: "s1", amount: 600 },
          { scheduleId: "s1", amount: 400 },
          { scheduleId: "s2", amount: 150 },
        ],
        new Map(),
        shares,
      ),
    ).toBe(250);
  });

  it("skips schedules with no known principal share", () => {
    expect(
      dayProfit([{ scheduleId: "x", amount: 900 }], new Map(), share),
    ).toBe(0);
  });
});

describe("paidProfit", () => {
  it("splits a partial payment's profit in proportion", () => {
    // ₱840 due, ₱700 principal: ₱140 profit, so ₱660 paid carries ₱110.
    expect(paidProfit(660, 840, 700)).toBe(110);
  });

  it("is the whole profit once paid in full, and never more", () => {
    expect(paidProfit(840, 840, 700)).toBe(140);
    expect(paidProfit(900, 840, 700)).toBe(140);
  });

  it("is nothing before any payment or without profit", () => {
    expect(paidProfit(0, 840, 700)).toBe(0);
    expect(paidProfit(500, 1000, 1000)).toBe(0);
  });
});
