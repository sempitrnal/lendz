import { describe, expect, it } from "vitest";
import { manilaToday, monthOf, resolveDate, shiftDate } from "./date";

const TODAY = "2026-11-12";

describe("resolveDate", () => {
  it("uses today when there is no date", () => {
    expect(resolveDate(undefined, TODAY)).toBe(TODAY);
  });

  it("keeps a real date that is not in the future", () => {
    expect(resolveDate("2026-11-01", TODAY)).toBe("2026-11-01");
    expect(resolveDate(TODAY, TODAY)).toBe(TODAY);
  });

  it("falls back to today for a future date", () => {
    expect(resolveDate("2026-11-13", TODAY)).toBe(TODAY);
  });

  it("falls back to today for a date that does not exist", () => {
    expect(resolveDate("2026-02-30", TODAY)).toBe(TODAY);
  });

  it("falls back to today for garbage", () => {
    expect(resolveDate("abc", TODAY)).toBe(TODAY);
    expect(resolveDate("", TODAY)).toBe(TODAY);
  });
});

describe("shiftDate", () => {
  it("crosses a year end", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("crosses a month end backwards in a non-leap February", () => {
    expect(shiftDate("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("monthOf", () => {
  it("is the yyyy-mm of a date", () => {
    expect(monthOf("2026-11-12")).toBe("2026-11");
  });
});

describe("manilaToday", () => {
  it("is already the next day just after 16:00 UTC", () => {
    expect(manilaToday(new Date("2026-11-12T17:00:00Z"))).toBe("2026-11-13");
  });

  it("is still the same day before then", () => {
    expect(manilaToday(new Date("2026-11-12T15:00:00Z"))).toBe("2026-11-12");
  });
});
