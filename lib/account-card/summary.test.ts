import { describe, expect, it } from "vitest";
import type { InstallmentDot } from "@/lib/payment-schedule/installment-dots";
import {
  barRightLabel,
  formatAmount,
  payoffPercent,
  releasedLabel,
  releaseDateLabel,
  shortDate,
} from "./summary";

const dot = (state: InstallmentDot["state"]): InstallmentDot => ({
  due_date: "2026-10-24",
  state,
  amount_due: 100,
  amount_paid: state === "paid" ? 100 : 0,
});

describe("payoffPercent", () => {
  it("is the share paid", () => {
    expect(payoffPercent(8000, 21000)).toBeCloseTo(38.1, 1);
  });
  it("is 0 when nothing is due or the inputs are not numbers", () => {
    expect(payoffPercent(5, 0)).toBe(0);
    expect(payoffPercent(Number.NaN, 10)).toBe(0);
  });
  it("stops at 100", () => {
    expect(payoffPercent(30, 10)).toBe(100);
  });
});

describe("barRightLabel", () => {
  it("counts paid installments on a schedule", () => {
    const installments = [
      dot("paid"),
      dot("paid"),
      dot("paid"),
      dot("pending"),
      dot("pending"),
      dot("overdue"),
    ];
    expect(barRightLabel({ isManual: false, installments, totalPaid: 0 })).toBe(
      "3 of 6 paid",
    );
  });
  it("is empty when a scheduled account has no installments", () => {
    expect(
      barRightLabel({ isManual: false, installments: [], totalPaid: 0 }),
    ).toBe("");
  });
  it("shows the amount collected on a manual account", () => {
    expect(
      barRightLabel({ isManual: true, installments: [], totalPaid: 1500 }),
    ).toBe(`₱${formatAmount(1500)} collected`);
  });
});

describe("formatAmount", () => {
  it("rounds to two decimals", () => {
    expect(Number(formatAmount(379.997).replace(/[^\d.]/g, ""))).toBe(380);
  });
});

describe("releasedLabel", () => {
  it("says how long ago the account was released", () => {
    expect(releasedLabel(0)).toBe("released today");
    expect(releasedLabel(3)).toBe("released 3d ago");
    expect(releasedLabel(14)).toBe("released 2w ago");
    expect(releasedLabel(90)).toBe("released 3mo ago");
    expect(releasedLabel(800)).toBe("released 2y ago");
  });

  it("counts down to a release date that hasn't come", () => {
    expect(releasedLabel(-5)).toBe("releases in 5d");
  });
});

describe("shortDate", () => {
  it("names the month and drops the leading zero", () => {
    expect(shortDate("2026-11-03")).toBe("Nov 3");
    expect(shortDate("2026-01-31T00:00:00Z")).toBe("Jan 31");
  });
});

describe("releaseDateLabel", () => {
  it("leaves the year off for this year only", () => {
    expect(releaseDateLabel("2026-09-15", 2026)).toBe("Sep 15");
    expect(releaseDateLabel("2025-12-03", 2026)).toBe("Dec 3, 2025");
  });
});
