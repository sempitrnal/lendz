import { describe, expect, it } from "vitest";
import { composeLabel, labelParts } from "@/lib/checklist/composer";
import { collectionRowModel } from "@/lib/checklist/labels";
import { planNoteSave, planPlainSave } from "@/lib/checklist/note-edit";
import type { DueChecklistItem } from "@/lib/checklist/types";

const DAY = "2026-10-19";
const ana = { id: "a1", name: "ana cruz" };
const lines: DueChecklistItem[] = [
  { id: "s1", due_date: "2026-10-19", amount: 1850, type: "loan" },
];
const collect = (note: string) =>
  composeLabel({ borrower: ana, others: [], lines, note });

describe("planNoteSave", () => {
  it("does nothing when the note is unchanged", () => {
    expect(
      planNoteSave(collect("promised 22nd"), DAY, "promised 22nd"),
    ).toEqual({ action: "none" });
    expect(
      planNoteSave(collect("promised 22nd"), DAY, "  promised 22nd \n"),
    ).toEqual({ action: "none" });
    expect(planNoteSave(collect(""), DAY, "   ")).toEqual({ action: "none" });
  });

  it("adds a note and keeps the mention and dues", () => {
    const plan = planNoteSave(collect(""), DAY, "call first");
    if (plan.action !== "save") throw new Error("expected save");
    expect(labelParts(plan.label, DAY)).toEqual({
      borrower: ana,
      lines,
      note: "call first",
    });
    expect(collectionRowModel(plan.label, DAY)?.note).toBe("call first");
  });

  it("clears a note and the row note disappears", () => {
    const plan = planNoteSave(collect("call first"), DAY, "");
    if (plan.action !== "save") throw new Error("expected save");
    expect(collectionRowModel(plan.label, DAY)?.note).toBe("");
    expect(labelParts(plan.label, DAY).lines).toEqual(lines);
  });

  it.each(["paid ₱500 cash", "see [bob](/borrowers/x) first", "/next week"])(
    "keeps %s intact",
    (text) => {
      const plan = planNoteSave(collect("old"), DAY, text);
      if (plan.action !== "save") throw new Error("expected save");
      expect(labelParts(plan.label, DAY).note).toBe(text);
    },
  );

  it("keeps `with` mentions", () => {
    const label = composeLabel({
      borrower: ana,
      others: [{ id: "b2", name: "bo" }],
      lines,
      note: "x",
    });
    const plan = planNoteSave(label, DAY, "y");
    if (plan.action !== "save") throw new Error("expected save");
    expect(labelParts(plan.label, DAY).note).toBe("y");
    expect(plan.label).toContain("with [bo](/borrowers/b2)");
  });

  it("edits a plain note's text", () => {
    expect(planNoteSave("bring change", DAY, "bring change tomorrow")).toEqual({
      action: "save",
      label: "bring change tomorrow",
    });
  });

  it("blocks emptying a plain note, but not one with a mention", () => {
    expect(planNoteSave("bring change", DAY, "")).toEqual({
      action: "blocked",
    });
    expect(
      planNoteSave("[ana cruz](/borrowers/a1) bring change", DAY, ""),
    ).toEqual({ action: "save", label: "[ana cruz](/borrowers/a1)" });
  });
});

describe("planPlainSave", () => {
  const label = "call [Ana Cruz](/borrowers/a1) later with [b](/borrowers/2)";
  it("does nothing when unchanged", () => {
    expect(planPlainSave(label, `  ${label}\n`)).toEqual({ action: "none" });
  });
  it("keeps mentions in place with their links", () => {
    const edited = label.replace("later", "tomorrow");
    expect(planPlainSave(label, edited)).toEqual({
      action: "save",
      label: edited,
    });
  });
  it("blocks emptying", () => {
    expect(planPlainSave(label, " ")).toEqual({ action: "blocked" });
  });
});
