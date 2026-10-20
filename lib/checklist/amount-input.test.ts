import { describe, expect, it } from "vitest";
import { cents, parseAmountInput } from "@/lib/checklist/amount-input";

describe("parseAmountInput", () => {
  it("reads plain numbers", () => {
    expect(parseAmountInput("1500")).toBe(1500);
    expect(parseAmountInput("1500.50")).toBe(1500.5);
    expect(parseAmountInput(".5")).toBe(0.5);
    expect(parseAmountInput("0")).toBe(0);
    expect(parseAmountInput("12.")).toBe(12);
  });

  it("strips thousands commas in the usual places", () => {
    expect(parseAmountInput("1,500")).toBe(1500);
    expect(parseAmountInput("12,345.67")).toBe(12345.67);
    expect(parseAmountInput("1,234,567")).toBe(1234567);
  });

  it("accepts a peso sign and spaces", () => {
    expect(parseAmountInput(" ₱1,500 ")).toBe(1500);
    expect(parseAmountInput("₱ 200")).toBe(200);
  });

  it("rejects misplaced commas instead of reading a smaller amount", () => {
    expect(parseAmountInput("1,5")).toBeNull();
    expect(parseAmountInput("1,50")).toBeNull();
    expect(parseAmountInput("1500,00")).toBeNull();
    expect(parseAmountInput("1.500,00")).toBeNull();
    expect(parseAmountInput(",500")).toBeNull();
  });

  it("rejects empty, negative and non-numeric input", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("   ")).toBeNull();
    expect(parseAmountInput("-200")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("12abc")).toBeNull();
    expect(parseAmountInput("1e3")).toBeNull();
    expect(parseAmountInput(".")).toBeNull();
  });
});

describe("cents", () => {
  it("rounds to centavos", () => {
    expect(cents(0.1 + 0.2)).toBe(0.3);
    expect(cents(1356.428)).toBe(1356.43);
  });
});
