import { describe, expect, it } from "vitest";
import {
  blocksPaymentChanges,
  heldBackPointer,
  isManualSummary,
  MANUAL_ACCOUNT_POINTER,
  UNCHECKED_ACCOUNT_POINTER,
} from "@/lib/checklist/manual-accounts";

const summaries = {
  loan: { typeLabel: "loan" },
  ca: { typeLabel: "cash advance" },
  rolling: { typeLabel: "loan · manual rolling" },
  flat: { typeLabel: "cash advance · manual flat" },
};

describe("isManualSummary", () => {
  it("reads the type label the summaries are built with", () => {
    expect(isManualSummary(summaries.rolling)).toBe(true);
    expect(isManualSummary(summaries.flat)).toBe(true);
    expect(isManualSummary(summaries.loan)).toBe(false);
    expect(isManualSummary(summaries.ca)).toBe(false);
    expect(isManualSummary(null)).toBe(false);
    expect(isManualSummary(undefined)).toBe(false);
  });
});

describe("blocksPaymentChanges", () => {
  it("blocks when any account is manual", () => {
    expect(blocksPaymentChanges(["loan", "rolling"], summaries)).toBe(true);
    expect(blocksPaymentChanges(["flat"], summaries)).toBe(true);
  });

  it("blocks when an account's type is unknown", () => {
    expect(blocksPaymentChanges(["loan", "missing"], summaries)).toBe(true);
    expect(blocksPaymentChanges(["loan"], null)).toBe(true);
    expect(blocksPaymentChanges(["loan"], undefined)).toBe(true);
  });

  it("allows scheduled accounts, and nothing to protect", () => {
    expect(blocksPaymentChanges(["loan", "ca"], summaries)).toBe(false);
    expect(blocksPaymentChanges([], null)).toBe(false);
  });
});

describe("heldBackPointer", () => {
  it("names a manual account, else says it couldn't check", () => {
    expect(heldBackPointer(["rolling", "missing"], summaries)).toBe(
      MANUAL_ACCOUNT_POINTER,
    );
    expect(heldBackPointer(["missing"], summaries)).toBe(
      UNCHECKED_ACCOUNT_POINTER,
    );
    expect(heldBackPointer(["loan"], summaries)).toBeNull();
    expect(MANUAL_ACCOUNT_POINTER).toBe(
      "Manual account — change its payments on the account page",
    );
  });
});
