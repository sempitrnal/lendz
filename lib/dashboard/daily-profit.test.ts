import { describe, expect, it } from "vitest";
import {
  compactAmount,
  dailyProfit,
  monthBounds,
  monthGrid,
  shiftMonth,
} from "./daily-profit";

const pay = (
  id: string,
  scheduleId: string,
  date: string,
  amount: number,
  createdAt: string | null = null,
  dueDate: string | null = null,
) => ({ id, scheduleId, date, amount, createdAt, dueDate });

describe("dailyProfit", () => {
  it("puts each payment's profit on the day it was paid", () => {
    const shares = new Map([
      ["s1", 1000],
      ["s2", 500],
    ]);
    const out = dailyProfit(
      [pay("a", "s1", "2026-11-03", 1200), pay("b", "s2", "2026-11-05", 600)],
      new Map(),
      shares,
    );
    expect(out).toEqual({
      "2026-11-03": {
        profit: 200,
        payments: 1,
        collected: 1200,
        otherMonths: 0,
      },
      "2026-11-05": {
        profit: 100,
        payments: 1,
        collected: 600,
        otherMonths: 0,
      },
    });
  });

  it("carries a partial into a later day of the same month", () => {
    const out = dailyProfit(
      [pay("b", "s1", "2026-11-10", 700), pay("a", "s1", "2026-11-02", 500)],
      new Map(),
      new Map([["s1", 1000]]),
    );
    // 500 is under the 1000 share; the 700 lifts it to 1200.
    expect(out["2026-11-02"].profit).toBe(0);
    expect(out["2026-11-10"].profit).toBe(200);
  });

  it("counts what was paid before the month began", () => {
    const out = dailyProfit(
      [pay("a", "s1", "2026-11-04", 300)],
      new Map([["s1", 1000]]),
      new Map([["s1", 1000]]),
    );
    expect(out["2026-11-04"].profit).toBe(300);
  });

  it("adds nothing for a schedule with no known share", () => {
    const out = dailyProfit(
      [pay("a", "s9", "2026-11-04", 300)],
      new Map(),
      new Map(),
    );
    expect(out["2026-11-04"]).toEqual({
      profit: 0,
      payments: 1,
      collected: 300,
      otherMonths: 0,
    });
  });

  it("separates profit on installments due in another month", () => {
    const shares = new Map([
      ["late", 1000],
      ["ontime", 1000],
      ["early", 1000],
    ]);
    const out = dailyProfit(
      [
        pay("a", "late", "2026-11-04", 1200, null, "2026-10-23"),
        pay("b", "ontime", "2026-11-04", 1300, null, "2026-11-08"),
        pay("c", "early", "2026-11-04", 1100, null, "2026-12-08"),
      ],
      new Map(),
      shares,
    );
    expect(out["2026-11-04"].profit).toBe(600);
    expect(out["2026-11-04"].otherMonths).toBe(300);
  });
});

describe("month helpers", () => {
  it("bounds a month, across the year end too", () => {
    expect(monthBounds("2026-11")).toEqual(["2026-11-01", "2026-12-01"]);
    expect(monthBounds("2026-12")).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("shifts months", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("lays a month out in weeks from Sunday", () => {
    const rows = monthGrid("2026-11"); // Nov 1, 2026 is a Sunday.
    expect(rows[0][0]).toBe("2026-11-01");
    expect(rows.every((r) => r.length === 7)).toBe(true);
    expect(rows.flat().filter(Boolean)).toHaveLength(30);
    expect(monthGrid("2026-10")[0].slice(0, 5)).toEqual([
      null,
      null,
      null,
      null,
      "2026-10-01",
    ]);
  });

  it("shortens amounts for a cell", () => {
    expect(compactAmount(850)).toBe("850");
    expect(compactAmount(1200)).toBe("1.2k");
    expect(compactAmount(2000)).toBe("2k");
    expect(compactAmount(12400)).toBe("12k");
    expect(compactAmount(1_500_000)).toBe("1.5m");
  });
});
