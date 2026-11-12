import { describe, expect, it } from "vitest";
import { lateLabel, paymentTiming } from "@/lib/checklist/late-label";

describe("lateLabel", () => {
  it("counts days under a month", () => {
    expect(lateLabel(15)).toEqual({ short: "15d", spoken: "15 days late" });
    expect(lateLabel(1)).toEqual({ short: "1d", spoken: "1 day late" });
    expect(lateLabel(29).short).toBe("29d");
  });

  it("counts months from 30 days, rounded down", () => {
    expect(lateLabel(30)).toEqual({ short: "1mo", spoken: "1 month late" });
    expect(lateLabel(59).short).toBe("1mo");
    expect(lateLabel(244)).toEqual({ short: "8mo", spoken: "8 months late" });
  });

  it("counts years from 365 days", () => {
    expect(lateLabel(365)).toEqual({ short: "1y", spoken: "1 year late" });
    expect(lateLabel(800)).toEqual({ short: "2y", spoken: "2 years late" });
  });
});

describe("paymentTiming", () => {
  it("says early, late or on time", () => {
    expect(paymentTiming("2026-11-15", "2026-11-14")).toEqual({
      text: "1d early",
      tone: "early",
    });
    expect(paymentTiming("2026-11-10", "2026-11-12")).toEqual({
      text: "2d late",
      tone: "late",
    });
    expect(paymentTiming("2026-11-12", "2026-11-12").text).toBe("on time");
  });

  it("uses months for long gaps and crosses month ends", () => {
    expect(paymentTiming("2026-09-30", "2026-11-12").text).toBe("1mo late");
    expect(paymentTiming("2026-10-31", "2026-11-01").text).toBe("1d late");
  });
});
