import { describe, expect, it } from "vitest";
import { currentStreak, solvedDates } from "./streak";
import { emptyProgress } from "./progress";

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(
      currentStreak(["2026-11-10", "2026-11-11", "2026-11-12"], "2026-11-12"),
    ).toBe(3);
  });

  it("still counts when the last solved day is yesterday", () => {
    expect(currentStreak(["2026-11-10", "2026-11-11"], "2026-11-12")).toBe(2);
  });

  it("is 0 after a missed day", () => {
    expect(currentStreak(["2026-11-10"], "2026-11-12")).toBe(0);
  });

  it("runs across a year end", () => {
    expect(currentStreak(["2026-12-31", "2027-01-01"], "2027-01-01")).toBe(2);
  });

  it("runs across a month end in a non-leap February", () => {
    expect(currentStreak(["2027-02-28", "2027-03-01"], "2027-03-01")).toBe(2);
  });

  it("stops at a gap", () => {
    expect(
      currentStreak(["2026-11-08", "2026-11-10", "2026-11-11"], "2026-11-11"),
    ).toBe(2);
  });

  it("is 0 with nothing solved", () => {
    expect(currentStreak([], "2026-11-12")).toBe(0);
  });

  it("counts a repeated date once", () => {
    expect(
      currentStreak(["2026-11-12", "2026-11-12", "2026-11-11"], "2026-11-12"),
    ).toBe(2);
  });
});

describe("solvedDates", () => {
  it("lists only the dates marked solved", () => {
    const all = {
      "2026-11-10": { ...emptyProgress, solved: true },
      "2026-11-11": { ...emptyProgress, solved: false },
    };
    expect(solvedDates(all)).toEqual(["2026-11-10"]);
  });
});
