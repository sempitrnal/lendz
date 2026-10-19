import { describe, expect, it } from "vitest";
import {
  planReschedule,
  statusFor,
  summarizeCarry,
  type ExistingSchedule,
  type NewSchedule,
} from "./reschedule";

const fresh = (due_date: string, amount_due = 3083.33): NewSchedule => ({
  account_id: "acct",
  due_date,
  amount_due,
  amount_paid: 0,
  remaining_amount: amount_due,
  status: "pending",
  note: null,
});

const row = (
  id: string,
  due_date: string,
  status: string,
  amount_paid: number,
  amount_due = 3083.33,
): ExistingSchedule => ({ id, due_date, amount_due, amount_paid, status });

describe("planReschedule carry", () => {
  // The case that prompted this: 5th & 20th entered as 4th & 19th.
  const existing = [
    row("a", "2026-06-05", "paid", 3083.33),
    row("b", "2026-06-20", "paid", 3083.33),
    row("c", "2026-07-05", "overdue", 0),
    row("d", "2026-07-20", "partial", 1542.5),
    row("e", "2026-08-05", "pending", 0),
  ];
  const next = [
    fresh("2026-06-04"),
    fresh("2026-06-19"),
    fresh("2026-07-04"),
    fresh("2026-07-19"),
    fresh("2026-08-04"),
  ];

  it("moves each row to the matching new date and keeps its id and payment", () => {
    const plan = planReschedule(existing, next, "carry", "2026-07-25");
    expect(plan.inserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.blocked).toEqual([]);
    expect(plan.updates.map((u) => [u.id, u.due_date, u.status])).toEqual([
      ["a", "2026-06-04", "paid"],
      ["b", "2026-06-19", "paid"],
      ["c", "2026-07-04", "overdue"],
      ["d", "2026-07-19", "partial"],
      ["e", "2026-08-04", "pending"],
    ]);
    expect(plan.updates[3]).toMatchObject({
      amount_paid: 1542.5,
      remaining_amount: 1540.83,
    });
  });

  it("matches by order even when rows arrive unsorted", () => {
    const plan = planReschedule(
      [...existing].reverse(),
      [...next].reverse(),
      "carry",
      "2026-07-25",
    );
    expect(plan.updates[0]).toMatchObject({ id: "a", due_date: "2026-06-04" });
  });

  it("adds the extra installments of a longer term as new rows", () => {
    const plan = planReschedule(
      existing.slice(0, 2),
      next,
      "carry",
      "2026-07-25",
    );
    expect(plan.updates).toHaveLength(2);
    expect(plan.inserts.map((s) => s.due_date)).toEqual([
      "2026-07-04",
      "2026-07-19",
      "2026-08-04",
    ]);
  });

  it("deletes unpaid leftovers of a shorter term but blocks paid ones", () => {
    const shorter = planReschedule(existing, next.slice(0, 3), "carry", "2026-07-25");
    expect(shorter.deletes).toEqual(["e"]);
    expect(shorter.blocked.map((r) => r.id)).toEqual(["d"]);
  });

  it("re-derives status when the amount changes", () => {
    const plan = planReschedule(
      [row("a", "2026-06-05", "paid", 3083.33)],
      [fresh("2026-06-05", 3500)],
      "carry",
      "2026-07-25",
    );
    expect(plan.updates[0]).toMatchObject({
      status: "partial",
      amount_paid: 3083.33,
      remaining_amount: 416.67,
    });
  });

  it("counts a legacy paid row with no amount as fully paid", () => {
    const plan = planReschedule(
      [row("a", "2026-06-05", "paid", 0)],
      [fresh("2026-06-04")],
      "carry",
      "2026-07-25",
    );
    expect(plan.updates[0]).toMatchObject({ status: "paid", amount_paid: 3083.33 });
  });
});

describe("planReschedule reset", () => {
  it("replaces every row", () => {
    const plan = planReschedule(
      [row("a", "2026-06-05", "paid", 3083.33)],
      [fresh("2026-06-04")],
      "reset",
      "2026-07-25",
    );
    expect(plan.deletes).toEqual(["a"]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.updates).toEqual([]);
    expect(plan.blocked).toEqual([]);
  });
});

describe("statusFor", () => {
  it("treats unpaid as overdue only once the due date has passed", () => {
    expect(statusFor(100, 0, "2026-07-24", "2026-07-25")).toBe("overdue");
    expect(statusFor(100, 0, "2026-07-25", "2026-07-25")).toBe("pending");
  });
});

describe("summarizeCarry", () => {
  it("counts paid and partial rows", () => {
    expect(
      summarizeCarry([
        row("a", "2026-06-05", "paid", 3083.33),
        row("b", "2026-06-20", "partial", 100),
        row("c", "2026-07-05", "pending", 0),
      ]),
    ).toEqual({ paid: 1, partial: 1 });
  });
});
