import { describe, expect, it } from "vitest";
import { showsPartial } from "@/lib/checklist/partial-display";

describe("showsPartial", () => {
  it("shows it when a payment on the viewed day went to this schedule", () => {
    expect(showsPartial("a", new Set(["a", "b"]))).toBe(true);
  });

  it("hides it on other days, when the payment was made earlier", () => {
    expect(showsPartial("a", new Set(["b"]))).toBe(false);
    expect(showsPartial("a", new Set())).toBe(false);
  });

  it("shows it while the day's payments are unknown (loading or offline)", () => {
    expect(showsPartial("a", null)).toBe(true);
    expect(showsPartial("a", undefined)).toBe(true);
  });
});
