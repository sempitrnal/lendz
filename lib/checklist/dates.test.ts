import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatLongDate,
  relativeDayLabel,
  shiftDateValue,
} from "@/lib/checklist/dates";

describe("shiftDateValue", () => {
  it("crosses month and year boundaries", () => {
    expect(shiftDateValue("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDateValue("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateValue("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("daysBetween", () => {
  it("counts whole days in either direction", () => {
    expect(daysBetween("2026-10-12", "2026-10-14")).toBe(2);
    expect(daysBetween("2026-10-14", "2026-10-12")).toBe(-2);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("relativeDayLabel", () => {
  const today = "2026-10-01";
  it("names the days around today", () => {
    expect(relativeDayLabel("2026-10-01", today)).toBe("today");
    expect(relativeDayLabel("2026-09-30", today)).toBe("yesterday");
    expect(relativeDayLabel("2026-10-02", today)).toBe("tomorrow");
    expect(relativeDayLabel("2026-10-05", today)).toBeNull();
  });
});

describe("formatLongDate", () => {
  it("is lowercase and only shows the year when it differs", () => {
    expect(formatLongDate("2026-10-14", "2026-10-14")).toBe(
      "wednesday, oct 14",
    );
    expect(formatLongDate("2025-12-31", "2026-01-01")).toBe(
      "wednesday, dec 31, 2025",
    );
  });
});
