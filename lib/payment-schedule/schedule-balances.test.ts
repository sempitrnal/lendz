import { describe, expect, it } from "vitest";
import { accountBalances } from "@/lib/payment-schedule/schedule-balances";

const row = (
  amount_due: number,
  amount_paid: number,
  status: string,
  remaining_amount: number | null = null,
) => ({ amount_due, amount_paid, status, remaining_amount });

describe("accountBalances", () => {
  it("sums installments for auto accounts", () => {
    const b = accountBalances(
      {
        principal_amount: 1000,
        interest_rate: 10,
        schedule_mode: "auto",
        interest_type: null,
      },
      [row(550, 550, "paid"), row(550, 200, "partial"), row(550, 0, "pending")],
    );
    expect(b.amountPaid).toBe(750);
    expect(b.amountLeftToPay).toBe(900);
    expect(b.profitToMake).toBe(650);
    expect(b.paidInstallments).toBe(1);
    expect(b.installmentCount).toBe(3);
  });

  it("uses principal + interest for manual flat accounts", () => {
    const b = accountBalances(
      {
        principal_amount: 1000,
        interest_rate: 20,
        schedule_mode: "manual",
        interest_type: "flat",
      },
      [row(300, 300, "paid"), row(300, 0, "pending")],
    );
    expect(b.isFlatManual).toBe(true);
    expect(b.manualFlatTotal).toBe(1200);
    expect(b.amountLeftToPay).toBe(900);
    expect(b.profitToMake).toBe(200);
  });

  it("ignores partial remainders for manual rolling accounts", () => {
    const b = accountBalances(
      {
        principal_amount: 1000,
        interest_rate: 10,
        schedule_mode: "manual",
        interest_type: "rolling",
      },
      [row(1100, 400, "partial"), row(800, 0, "pending")],
    );
    expect(b.isRolling).toBe(true);
    expect(b.amountPaid).toBe(400);
    expect(b.amountLeftToPay).toBe(800);
    expect(b.profitToMake).toBe(200);
  });
});
