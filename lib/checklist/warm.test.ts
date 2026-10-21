import { describe, expect, it } from "vitest";
import { labelsNeedingWarm } from "@/lib/checklist/warm";

const line = (id: string) =>
  `₱500 [Oct 21](#badge:date:2026-10-21|${id}) [Loan](#badge:type:loan)`;

describe("labelsNeedingWarm", () => {
  it("keeps only labels with a schedule not saved yet", () => {
    const cached = new Set(["s1", "s2"]);
    const a = `[ana](/borrowers/a)\n${line("s1")}`;
    const b = `[ben](/borrowers/b)\n${line("s2")}\n${line("s3")}`;
    const c = `[cy](/borrowers/c)\n${line("s4")}`;
    expect(
      labelsNeedingWarm([a, b, c, "plain note"], (id) => cached.has(id)),
    ).toEqual([b, c]);
  });

  it("returns nothing when everything is saved or nothing is linked", () => {
    expect(labelsNeedingWarm([line("s1")], () => true)).toEqual([]);
    expect(labelsNeedingWarm(["note", ""], () => false)).toEqual([]);
  });

  it("lists a repeated label once", () => {
    expect(labelsNeedingWarm([line("x"), line("x")], () => false)).toEqual([
      line("x"),
    ]);
  });
});
