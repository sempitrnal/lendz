import { describe, expect, it } from "vitest";
import {
  cents,
  formatAmountInput,
  indexAfterSignificant,
  parseAmountInput,
  significantBefore,
} from "@/lib/checklist/amount-input";

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

describe("formatAmountInput", () => {
  it("adds thousands commas as digits are typed", () => {
    expect(formatAmountInput("")).toBe("");
    expect(formatAmountInput("5")).toBe("5");
    expect(formatAmountInput("1500")).toBe("1,500");
    expect(formatAmountInput("1234567")).toBe("1,234,567");
    expect(formatAmountInput("1,500")).toBe("1,500");
    expect(formatAmountInput("12,3456")).toBe("123,456");
  });

  it("keeps a trailing dot and up to two decimals", () => {
    expect(formatAmountInput("1500.")).toBe("1,500.");
    expect(formatAmountInput("1500.5")).toBe("1,500.5");
    expect(formatAmountInput("1500.567")).toBe("1,500.56");
    expect(formatAmountInput(".5")).toBe("0.5");
    expect(formatAmountInput("1.2.3")).toBe("1.23");
  });

  it("drops letters, signs and the peso sign, and leading zeros", () => {
    expect(formatAmountInput("₱ 1,500")).toBe("1,500");
    expect(formatAmountInput("-5")).toBe("5");
    expect(formatAmountInput("abc")).toBe("");
    expect(formatAmountInput("007")).toBe("7");
  });

  it("round-trips through parseAmountInput", () => {
    for (const raw of ["1500", "1234567.89", "0.5", "999", "1000.1"]) {
      expect(parseAmountInput(formatAmountInput(raw))).toBe(Number(raw));
    }
  });
});

describe("caret helpers", () => {
  it("keeps the caret on the same digit when commas are added", () => {
    // typed "1500" with caret at the end → "1,500", caret still at the end
    const before = significantBefore("1500", 4);
    expect(indexAfterSignificant("1,500", before)).toBe(5);
    // caret after the "1" stays after the "1"
    expect(indexAfterSignificant("1,500", significantBefore("1500", 1))).toBe(
      1,
    );
  });

  it("handles an empty text", () => {
    expect(indexAfterSignificant("", 3)).toBe(0);
    expect(significantBefore("", 0)).toBe(0);
  });
});
