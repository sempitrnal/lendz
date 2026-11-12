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
  const solved = (solvedOn: string | null) => ({
    ...emptyProgress,
    solved: true,
    solvedOn,
  });

  it("lists a day solved on that day", () => {
    expect(solvedDates({ "2026-11-10": solved("2026-11-10") })).toEqual([
      "2026-11-10",
    ]);
  });

  it("ignores a day marked solved but not solved on that day", () => {
    expect(solvedDates({ "2026-11-10": solved("2026-11-12") })).toEqual([]);
    expect(solvedDates({ "2026-11-10": solved(null) })).toEqual([]);
  });

  it("ignores a day that is not solved", () => {
    expect(
      solvedDates({
        "2026-11-10": {
          ...emptyProgress,
          solved: false,
          solvedOn: "2026-11-10",
        },
      }),
    ).toEqual([]);
  });

  it("does not let solving missed days later repair the streak", () => {
    const all = {
      "2026-11-09": solved("2026-11-09"),
      "2026-11-10": solved("2026-11-12"),
      "2026-11-11": solved("2026-11-12"),
      "2026-11-12": solved("2026-11-12"),
    };
    expect(currentStreak(solvedDates(all), "2026-11-12")).toBe(1);
  });
});
