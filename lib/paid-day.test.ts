import { describe, expect, it } from "vitest";
import { paidDay } from "@/lib/paid-day";

const fmt = (iso: string) => `on ${iso}`;

describe("paidDay", () => {
  it("says today and yesterday, and the date otherwise", () => {
    const today = "2026-11-13";
    expect(paidDay("2026-11-13", fmt, { today })).toBe("today");
    expect(paidDay("2026-11-12", fmt, { today })).toBe("yesterday");
    expect(paidDay("2026-11-10", fmt, { today })).toBe("on 2026-11-10");
    expect(paidDay("2026-11-14", fmt, { today })).toBe("on 2026-11-14");
  });

  it("can start with a capital", () => {
    expect(
      paidDay("2026-11-13", fmt, { today: "2026-11-13", capital: true }),
    ).toBe("Today");
  });

  it("reads a timestamp by its date", () => {
    expect(paidDay("2026-11-13T05:00:00Z", fmt, { today: "2026-11-13" })).toBe(
      "today",
    );
  });
});
