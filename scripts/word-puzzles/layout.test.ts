import { describe, expect, it } from "vitest";
import { findLayoutProblems } from "../../lib/word-game/layout-check";
import { layoutCrossword } from "./layout";
import { mulberry32 } from "./rng";

describe("layoutCrossword", () => {
  it("places every word, connected, inside 8 by 8", () => {
    const layout = layoutCrossword(["PLANE", "PEN", "ALE"], mulberry32(1));
    expect(layout).not.toBeNull();
    expect(layout!.words.map((w) => w.word).sort()).toEqual([
      "ALE",
      "PEN",
      "PLANE",
    ]);
    expect(findLayoutProblems(layout!)).toEqual([]);
    expect(layout!.grid.rows).toBeLessThanOrEqual(8);
    expect(layout!.grid.cols).toBeLessThanOrEqual(8);
  });

  it("starts at row 0, col 0", () => {
    const layout = layoutCrossword(["PLANE", "PEN", "ALE"], mulberry32(1))!;
    expect(Math.min(...layout.words.map((w) => w.row))).toBe(0);
    expect(Math.min(...layout.words.map((w) => w.col))).toBe(0);
  });

  it("gives the same layout for the same seed", () => {
    const a = layoutCrossword(["PLANE", "PEN", "ALE", "LEAN"], mulberry32(3));
    const b = layoutCrossword(["PLANE", "PEN", "ALE", "LEAN"], mulberry32(3));
    expect(a).toEqual(b);
  });

  it("is null when words share no letters", () => {
    expect(layoutCrossword(["ABC", "XYZ"], mulberry32(1))).toBeNull();
  });

  it("never returns a layout with problems, across many seeds", () => {
    let placed = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const layout = layoutCrossword(
        ["PLANE", "PEN", "ALE", "LEAN"],
        mulberry32(seed),
      );
      if (!layout) continue;
      placed += 1;
      expect(findLayoutProblems(layout)).toEqual([]);
    }
    expect(placed).toBeGreaterThan(0);
  });
});
