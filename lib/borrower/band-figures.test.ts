import { describe, expect, it } from "vitest";
import { bandFigures } from "@/lib/borrower/band-figures";

const m = (over: Partial<Parameters<typeof bandFigures>[1][string]> = {}) => ({
  amountLeftToPay: 0,
  totalPaid: 0,
  totalDue: 0,
  overdueCount: 0,
  nextCollectionDate: null,
  nextCollectionAmount: 0,
  ...over,
});

describe("bandFigures", () => {
  it("is all zeros with no accounts", () => {
    expect(bandFigures([], {})).toEqual({
      remaining: 0,
      collected: 0,
      totalDue: 0,
      pct: 0,
      overdueCount: 0,
      next: null,
    });
  });

  it("adds the balance up across accounts", () => {
    const f = bandFigures(
      [
        { id: "a", status: "active" },
        { id: "b", status: "active" },
      ],
      {
        a: m({ amountLeftToPay: 600, totalPaid: 400, totalDue: 1000 }),
        b: m({ amountLeftToPay: 100, totalPaid: 100, totalDue: 200 }),
      },
    );
    expect(f.remaining).toBe(700);
    expect(f.collected).toBe(500);
    expect(f.totalDue).toBe(1200);
    expect(f.pct).toBeCloseTo(41.67, 1);
  });

  it("picks the soonest collection and ignores empty ones", () => {
    const f = bandFigures(
      [
        { id: "a", status: "active" },
        { id: "b", status: "active" },
        { id: "c", status: "active" },
      ],
      {
        a: m({
          nextCollectionDate: "2026-11-10T00:00:00Z",
          nextCollectionAmount: 500,
        }),
        b: m({ nextCollectionDate: "2026-11-03", nextCollectionAmount: 2100 }),
        c: m({ nextCollectionDate: "2026-10-01", nextCollectionAmount: 0 }),
      },
    );
    expect(f.next).toEqual({ date: "2026-11-03", amount: 2100 });
  });

  it("counts overdue only on active accounts", () => {
    const f = bandFigures(
      [
        { id: "a", status: "active" },
        { id: "b", status: "pending" },
      ],
      {
        a: m({
          overdueCount: 2,
          nextCollectionDate: "2026-11-03",
          nextCollectionAmount: 10,
        }),
        b: m({
          amountLeftToPay: 2500,
          totalDue: 2500,
          overdueCount: 5,
          nextCollectionDate: "2026-10-01",
          nextCollectionAmount: 99,
        }),
      },
    );
    expect(f.overdueCount).toBe(2);
    expect(f.next?.date).toBe("2026-11-03");
    // Pending still counts towards the balance.
    expect(f.remaining).toBe(2500);
  });

  it("skips accounts with no metrics and caps the share at 100", () => {
    const f = bandFigures(
      [
        { id: "a", status: "active" },
        { id: "ghost", status: "active" },
      ],
      { a: m({ totalPaid: 300, totalDue: 200 }) },
    );
    expect(f.pct).toBe(100);
  });
});
