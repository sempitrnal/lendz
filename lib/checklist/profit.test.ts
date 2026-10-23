import { describe, expect, it } from "vitest";
import { principalShare, profitOnInstallment } from "@/lib/checklist/profit";

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
