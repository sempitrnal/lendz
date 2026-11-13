import { describe, expect, it } from "vitest";
import { paymentTimingStats, timingText } from "@/lib/checklist/day-summary";

const pay = (scheduleId: string, dueDate: string | null, amount = 0) => ({
  scheduleId,
  amount,
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

import { summarizeDay } from "@/lib/checklist/day-summary";
import type { RowView } from "@/lib/checklist/row-state";

const line = (
  due: string,
  left: number,
  state: "paid" | "partial" | "unpaid" = "unpaid",
  id = due,
) => ({ id, due_date: due, original: 100, left, state });
const row = (lines: ReturnType<typeof line>[]) =>
  ({ item: { checklist_date: "2026-11-13" }, lines }) as unknown as RowView;

describe("summarizeDay", () => {
  it("counts today's installments only, not the row's older or later ones", () => {
    const rows = [
      // Paid today, but the same borrower has an old overdue one open.
      row([line("2026-11-13", 0, "paid"), line("2026-10-01", 100)]),
      // Today's own, still open, with one due next week.
      row([line("2026-11-13", 100), line("2026-11-20", 100)]),
    ];
    const day = summarizeDay(rows);
    expect(day.today).toMatchObject({ left: 100, due: 200, done: 1, count: 2 });
    expect(day.carried).toMatchObject({ left: 100, due: 100, count: 1 });
  });

  it("is all paid with nothing left when every due-today installment is paid", () => {
    const day = summarizeDay([row([line("2026-11-13", 0, "paid")])]);
    expect(day.today).toMatchObject({ left: 0, done: 1, count: 1 });
  });

  it("counts an installment paid early today as done, not as left", () => {
    const rows = [row([line("2026-11-20", 0, "paid", "early")])];
    const day = summarizeDay(rows, new Set(["early"]));
    expect(day.today).toMatchObject({ left: 0, done: 1, count: 1 });
  });

  it("collected is what was paid on the day: a part payment counts its part", () => {
    const rows = [
      // 100 due today, only 30 of it paid today (and 20 on an earlier day).
      row([line("2026-11-13", 50, "partial", "today")]),
      // An old overdue installment, 40 paid today.
      row([line("2026-10-01", 60, "partial", "old")]),
    ];
    const day = summarizeDay(rows, null, [
      { scheduleId: "today", amount: 30, dueDate: "2026-11-13" },
      { scheduleId: "old", amount: 40, dueDate: "2026-10-01" },
    ]);
    expect(day.today.collected).toBe(30);
    expect(day.carried.collected).toBe(40);
  });

  it("counts a payment whose schedule is not on the list", () => {
    const day = summarizeDay([row([line("2026-11-13", 100)])], null, [
      { scheduleId: "elsewhere", amount: 20, dueDate: "2026-11-20" },
    ]);
    expect(day.today.collected).toBe(20);
  });
});
