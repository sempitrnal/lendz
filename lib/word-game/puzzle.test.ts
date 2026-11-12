import { describe, expect, it } from "vitest";
import { classifyWord, gridCells } from "./puzzle";
import { testPuzzle } from "./test-puzzle";

describe("classifyWord", () => {
  it("calls a word in the grid a grid word, in any case", () => {
    expect(classifyWord(testPuzzle, "plane")).toBe("grid");
    expect(classifyWord(testPuzzle, "PEN")).toBe("grid");
  });

  it("calls a valid word that is not in the grid a bonus word", () => {
    expect(classifyWord(testPuzzle, "lap")).toBe("bonus");
  });

  it("calls anything else invalid", () => {
    expect(classifyWord(testPuzzle, "zzz")).toBe("invalid");
  });

  it("calls words under 3 letters, and the empty word, invalid", () => {
    expect(classifyWord(testPuzzle, "pa")).toBe("invalid");
    expect(classifyWord(testPuzzle, "")).toBe("invalid");
  });
});

describe("gridCells", () => {
  const cells = gridCells(testPuzzle);

  it("maps each filled square to its letter", () => {
    expect(cells.get("0,0")).toBe("P");
    expect(cells.get("1,0")).toBe("E");
    expect(cells.get("2,2")).toBe("E");
  });

  it("has no entry for an empty square", () => {
    expect(cells.get("1,1")).toBeUndefined();
  });

  it("counts a shared square once", () => {
    expect(cells.size).toBe(9);
  });
});
