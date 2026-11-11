import { describe, expect, it } from "vitest";
import { profitCollectionRate, projectProfit } from "@/lib/profit-projection";

describe("profitCollectionRate", () => {
  it("pools the months, so a big month counts for more than a small one", () => {
    const rate = profitCollectionRate([
      { profit: 900, expectedProfit: 1000 },
      { profit: 50, expectedProfit: 100 },
    ]);
    // (900 + 50) / (1000 + 100), not the average of 90% and 50%.
    expect(rate?.rate).toBeCloseTo(950 / 1100);
    expect(rate?.months).toBe(2);
  });

  it("skips months that expected no profit", () => {
    const rate = profitCollectionRate([
      { profit: 0, expectedProfit: 0 },
      { profit: 80, expectedProfit: 100 },
    ]);
    expect(rate).toEqual({ rate: 0.8, months: 1 });
  });

  it("has no rate without any history", () => {
    expect(profitCollectionRate([])).toBeNull();
    expect(profitCollectionRate([{ profit: 0, expectedProfit: 0 }])).toBeNull();
  });

  it("never goes past 100%", () => {
    expect(
      profitCollectionRate([{ profit: 120, expectedProfit: 100 }])?.rate,
    ).toBe(1);
  });
});

describe("projectProfit", () => {
  it("is the expected profit times the rate", () => {
    expect(projectProfit({ expectedProfit: 1000, profit: 100 }, 0.75)).toBe(750);
  });

  it("is never less than what is already collected", () => {
    expect(projectProfit({ expectedProfit: 1000, profit: 900 }, 0.75)).toBe(900);
  });
});
