import { describe, expect, it } from "vitest";
import { manilaDate } from "@/lib/checklist/auto-populate";

describe("manilaDate", () => {
  it("is the Philippine calendar day (UTC+8)", () => {
    expect(manilaDate(new Date("2026-10-22T15:59:59Z"))).toBe("2026-10-22");
    expect(manilaDate(new Date("2026-10-22T16:00:00Z"))).toBe("2026-10-23");
  });
  it("5 AM Manila (21:00 UTC the day before) is that Manila day", () => {
    expect(manilaDate(new Date("2026-10-22T21:00:00Z"))).toBe("2026-10-23");
  });
  it("rolls over a month and a year", () => {
    expect(manilaDate(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });
});
