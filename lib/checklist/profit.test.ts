import { describe, expect, it } from "vitest";
import {
  installmentProfit,
  principalShare,
  profitOnInstallment,
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
