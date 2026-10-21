import { describe, expect, it } from "vitest";
import {
  atQuery,
  composeLabel,
  labelParts,
  removeAtToken,
  stripNextToken,
  withNote,
} from "@/lib/checklist/composer";
import {
  collectionRowModel,
  extractBorrowerMention,
} from "@/lib/checklist/labels";
import type { DueChecklistItem } from "@/lib/checklist/types";

const DAY = "2026-10-19";
const ana = { id: "a1", name: "ana cruz" };
const lines: DueChecklistItem[] = [
  { id: "s1", due_date: "2026-10-19", amount: 1850, type: "loan" },
  { id: "s2", due_date: "2026-10-19", amount: 742.5, type: "cash_advance" },
];

describe("tokens", () => {
  it("reads the @ query", () => {
    expect(atQuery("call @ma")).toBe("ma");
    expect(atQuery("call ma")).toBeNull();
    expect(atQuery("@")).toBe("");
  });
  it("removes the @ token", () => {
    expect(removeAtToken("call @ma")).toBe("call ");
  });
  it("strips /next", () => {
    expect(stripNextToken("pay /next now")).toEqual({
      text: "pay now",
      hadNext: true,
    });
    expect(stripNextToken("pay now")).toEqual({
      text: "pay now",
      hadNext: false,
    });
  });
});

describe("composeLabel / labelParts", () => {
  it("compose then parse returns the same parts", () => {
    const label = composeLabel({
      borrower: ana,
      others: [],
      lines,
      note: "promised the 22nd",
    });
    expect(labelParts(label, DAY)).toEqual({
      borrower: ana,
      lines,
      note: "promised the 22nd",
    });
    expect(collectionRowModel(label, DAY)?.total).toBe(2592.5);
  });

  it.each(["paid ₱500 cash", "see [bob](/borrowers/x) first", "/next week"])(
    "keeps the note %j intact",
    (note) => {
      const label = composeLabel({ borrower: ana, others: [], lines, note });
      const parts = labelParts(label, DAY);
      expect(parts.note).toBe(note);
      expect(parts.lines).toEqual(lines);
      const bare = composeLabel({ borrower: ana, others: [], lines: [], note });
      expect(labelParts(bare, DAY).note).toBe(note);
      expect(labelParts(bare, DAY).lines).toEqual([]);
    },
  );

  it("writes no-line labels on one line", () => {
    expect(
      composeLabel({ borrower: ana, others: [], lines: [], note: "call" }),
    ).toBe("[ana cruz](/borrowers/a1) call");
  });

  it("others are written as mentions after the note", () => {
    const label = composeLabel({
      borrower: ana,
      others: [{ id: "c1", name: "carlo" }],
      lines,
      note: "promised",
    });
    expect(label.endsWith("with [carlo](/borrowers/c1)")).toBe(true);
    expect(extractBorrowerMention(label)).toEqual(ana);
    expect(labelParts(label, DAY).note).toBe("promised");
  });
});

describe("withNote", () => {
  it("replaces only the note", () => {
    const label = composeLabel({
      borrower: ana,
      others: [{ id: "c1", name: "carlo" }],
      lines,
      note: "old",
    });
    const next = withNote(label, DAY, "new");
    expect(next).toBe(
      composeLabel({
        borrower: ana,
        others: [{ id: "c1", name: "carlo" }],
        lines,
        note: "new",
      }),
    );
    expect(labelParts(next, DAY).lines).toEqual(lines);
  });
  it("removes the note when empty", () => {
    const label = composeLabel({
      borrower: ana,
      others: [],
      lines,
      note: "old",
    });
    expect(labelParts(withNote(label, DAY, ""), DAY).note).toBe("");
  });
});
