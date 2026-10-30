import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { dropSchedulesFromLabel } from "@/lib/checklist/account-cleanup";

const line = (amount: string, date: string, id: string) =>
  `₱${amount} [${date}](#badge:date:2026-10-30|${id}) [Loan](#badge:type:loan)`;

describe("dropSchedulesFromLabel", () => {
  const label = [
    "[mila](/borrowers/m)",
    line("1,450", "Oct 30", "a1"),
    line("600", "Oct 30", "b1"),
    "Total: ₱2,050",
  ].join("\n");

  it("keeps items that link none of them", () => {
    expect(dropSchedulesFromLabel(label, new Set(["z"]))).toEqual({
      kind: "keep",
    });
    expect(dropSchedulesFromLabel("call mila", new Set(["a1"]))).toEqual({
      kind: "keep",
    });
  });

  it("deletes items that link nothing else", () => {
    expect(dropSchedulesFromLabel(label, new Set(["a1", "b1"]))).toEqual({
      kind: "delete",
    });
  });

  it("drops only the deleted account's lines and its total", () => {
    expect(dropSchedulesFromLabel(label, new Set(["a1"]))).toEqual({
      kind: "update",
      label: [
        "[mila](/borrowers/m)",
        "₱600 [Oct 30](#badge:date:2026-10-30|b1) [Loan](#badge:type:loan)",
      ].join("\n"),
    });
  });
});
