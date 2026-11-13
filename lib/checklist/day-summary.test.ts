import { describe, expect, it } from "vitest";
import { paymentTimingStats, timingText } from "@/lib/checklist/day-summary";

const pay = (scheduleId: string, dueDate: string | null) => ({
  scheduleId,
  dueDate,
});

describe("paymentTimingStats", () => {
  it("counts early, late and on-time schedules with average gaps", () => {
    const stats = paymentTimingStats(
      [
        pay("a", "2026-11-15"), // 2 days early
        pay("b", "2026-11-17"), // 4 days early
        pay("c", "2026-11-10"), // 3 days late
        pay("d", "2026-11-13"), // on time
      ],
      "2026-11-13",
    );
    expect(stats.early).toEqual({ count: 2, avgDays: 3 });
    expect(stats.late).toEqual({ count: 1, avgDays: 3 });
    expect(stats.onTime).toBe(1);
  });

  it("counts a schedule paid in several parts once", () => {
    const stats = paymentTimingStats(
      [pay("a", "2026-11-15"), pay("a", "2026-11-15")],
      "2026-11-13",
    );
    expect(stats.early.count).toBe(1);
  });

  it("skips payments with no due date and schedules outside the list", () => {
    const stats = paymentTimingStats(
      [pay("a", null), pay("b", "2026-11-15"), pay("c", "2026-11-15")],
      "2026-11-13",
      new Set(["c"]),
    );
    expect(stats.early.count).toBe(1);
    expect(stats.late.count).toBe(0);
  });
});

describe("timingText", () => {
  it("words the line, and is null when there are none", () => {
    expect(timingText("early", { count: 3, avgDays: 2 })).toBe(
      "3 paid early · avg 2d",
    );
    expect(timingText("late", { count: 2, avgDays: 45 })).toBe(
      "2 paid late · avg 1mo",
    );
    expect(timingText("late", { count: 0, avgDays: 0 })).toBeNull();
  });
});
