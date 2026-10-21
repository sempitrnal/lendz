import { describe, expect, it } from "vitest";
import { selectPopulateLabels } from "@/lib/checklist/populate";
import { buildDueLabel } from "@/lib/checklist/labels";
import type { DueChecklistGroup } from "@/lib/checklist/types";

const group = (
  borrower_id: string,
  name: string,
  ids: string[],
): DueChecklistGroup => ({
  borrower_id,
  name,
  items: ids.map((id) => ({
    id,
    due_date: "2026-10-14",
    amount: 100,
    type: "loan" as const,
  })),
});

const rowFor = (g: DueChecklistGroup) => ({ label: buildDueLabel(g) });

describe("selectPopulateLabels", () => {
  it("skips a borrower who already has a collection row", () => {
    const a = group("a", "ann", ["s1"]);
    const b = group("b", "bob", ["s2"]);
    expect(selectPopulateLabels([a, b], [rowFor(a)])).toEqual([
      buildDueLabel(b),
    ]);
  });

  it("drops schedule ids listed under another row and removes empty groups", () => {
    const listed = group("a", "ann", ["s1"]);
    const b = group("b", "bob", ["s1", "s2"]);
    const c = group("c", "cy", ["s1"]);
    const result = selectPopulateLabels([b, c], [rowFor(listed)]);
    expect(result).toEqual([buildDueLabel(group("b", "bob", ["s2"]))]);
  });

  it("does not let a plain-note row block that borrower", () => {
    const b = group("b", "bob", ["s2"]);
    const note = { label: "[bob](/borrowers/b) call him tomorrow" };
    expect(selectPopulateLabels([b], [note])).toEqual([buildDueLabel(b)]);
  });

  it("keeps group order", () => {
    const gs = [group("z", "zed", ["1"]), group("a", "ann", ["2"])];
    expect(selectPopulateLabels(gs, [])).toEqual(gs.map(buildDueLabel));
  });
});
