import { describe, expect, it } from "vitest";
import {
  addBonus,
  addFound,
  addHint,
  emptyProgress,
  isSolved,
  pickHintCell,
  revealedCells,
} from "./progress";
import { testPuzzle } from "./test-puzzle";

describe("addFound", () => {
  it("stores a found word uppercase, once, even when added twice", () => {
    const once = addFound(testPuzzle, emptyProgress, "pen");
    const twice = addFound(testPuzzle, once, "PEN");
    expect(twice.found).toEqual(["PEN"]);
  });

  it("is solved only when every grid word is found", () => {
    let p = addFound(testPuzzle, emptyProgress, "PLANE");
    p = addFound(testPuzzle, p, "PEN");
    expect(p.solved).toBe(false);
    p = addFound(testPuzzle, p, "ALE");
    expect(p.solved).toBe(true);
  });

  it("does not change the progress it was given", () => {
    addFound(testPuzzle, emptyProgress, "PEN");
    expect(emptyProgress.found).toEqual([]);
  });
});

describe("the day a puzzle was solved on", () => {
  const almost = () => {
    let p = addFound(testPuzzle, emptyProgress, "PLANE");
    return addFound(testPuzzle, p, "PEN");
  };

  it("starts empty", () => {
    expect(emptyProgress.solvedOn).toBeNull();
  });

  it("is recorded when the last word is found", () => {
    const p = addFound(testPuzzle, almost(), "ALE", "2026-11-12");
    expect(p.solved).toBe(true);
    expect(p.solvedOn).toBe("2026-11-12");
  });

  it("stays empty while the puzzle is unsolved", () => {
    expect(
      addFound(testPuzzle, emptyProgress, "PEN", "2026-11-12").solvedOn,
    ).toBeNull();
  });

  it("keeps the first day when more is found later", () => {
    const done = addFound(testPuzzle, almost(), "ALE", "2026-11-12");
    expect(addFound(testPuzzle, done, "PEN", "2026-11-15").solvedOn).toBe(
      "2026-11-12",
    );
  });
});

describe("addBonus", () => {
  it("ignores a bonus word it already has", () => {
    const p = addBonus(addBonus(emptyProgress, "lap"), "LAP");
    expect(p.bonus).toEqual(["LAP"]);
  });
});

describe("revealedCells", () => {
  it("is the squares of found words plus hinted squares", () => {
    let p = addFound(testPuzzle, emptyProgress, "PEN");
    p = addHint(p, [0, 4]);
    expect(revealedCells(testPuzzle, p)).toEqual(
      new Set(["0,0", "1,0", "2,0", "0,4"]),
    );
  });
});

describe("a word whose squares are all filled but was never spelled", () => {
  it("is not counted found, and does not solve the puzzle", () => {
    // PLANE found fills (0,0); hints fill the rest of PEN.
    let p = addFound(testPuzzle, emptyProgress, "PLANE");
    p = addHint(p, [1, 0]);
    p = addHint(p, [2, 0]);
    p = addHint(p, [1, 2]);
    p = addHint(p, [2, 2]);
    expect(revealedCells(testPuzzle, p).has("2,0")).toBe(true);
    expect(p.found).toEqual(["PLANE"]);
    expect(isSolved(testPuzzle, p)).toBe(false);
  });
});

describe("pickHintCell", () => {
  it("takes the first unrevealed square, row-major, when random is 0", () => {
    expect(pickHintCell(testPuzzle, emptyProgress, () => 0)).toEqual([0, 0]);
  });

  it("is null when every word is found", () => {
    let p = emptyProgress;
    for (const w of ["PLANE", "PEN", "ALE"]) p = addFound(testPuzzle, p, w);
    expect(pickHintCell(testPuzzle, p, () => 0)).toBeNull();
  });

  it("never picks a square that is already revealed", () => {
    const p = addFound(testPuzzle, emptyProgress, "PEN");
    const revealed = revealedCells(testPuzzle, p);
    for (const r of [0, 0.5, 0.99]) {
      const cell = pickHintCell(testPuzzle, p, () => r);
      expect(cell).not.toBeNull();
      expect(revealed.has(`${cell![0]},${cell![1]}`)).toBe(false);
    }
  });
});
