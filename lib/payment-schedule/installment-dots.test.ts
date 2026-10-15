import { describe, expect, it } from "vitest";
import { installmentDots } from "@/lib/payment-schedule/installment-dots";

const row = (
  due_date: string,
  amount_due: number,
  amount_paid: number,
  status: string,
) => ({
  due_date,
  amount_due,
  amount_paid,
  remaining_amount: Math.max(0, amount_due - amount_paid),
  status,
});

describe("installmentDots", () => {
  it("sorts by due date and classifies each installment", () => {
    const dots = installmentDots([
      row("2026-11-30", 270, 0, "pending"),
      row("2026-10-30", 270, 270, "paid"),
      row("2026-11-15", 270, 60, "partial"),
      row("2026-10-15", 270, 0, "overdue"),
    ]);
    expect(dots.map((d) => [d.due_date, d.state])).toEqual([
      ["2026-10-15", "overdue"],
      ["2026-10-30", "paid"],
      ["2026-11-15", "partial"],
      ["2026-11-30", "pending"],
    ]);
  });

  it("calls an overdue schedule with payments partial, and a paid one paid", () => {
    const [partial, paid] = installmentDots([
      row("2026-10-01", 100, 40, "overdue"),
      row("2026-10-02", 100, 0, "paid"),
    ]);
    expect(partial.state).toBe("partial");
    expect(partial.amount_paid).toBe(40);
    expect(paid.state).toBe("paid");
    expect(paid.amount_paid).toBe(100);
  });
});
