import { describe, expect, it } from "vitest";
import { lateLabel } from "@/lib/checklist/late-label";

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
