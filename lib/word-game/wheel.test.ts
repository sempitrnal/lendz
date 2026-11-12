import { describe, expect, it } from "vitest";
import { extendChain, letterAt, letterPositions, shuffled } from "./wheel";

describe("letterPositions", () => {
  it("starts at the top and goes clockwise around the centre", () => {
    const p = letterPositions(4, 10);
    const want = [
      { x: 0, y: -10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -10, y: 0 },
    ];
    p.forEach((point, i) => {
      expect(point.x).toBeCloseTo(want[i].x);
      expect(point.y).toBeCloseTo(want[i].y);
    });
  });
});

describe("letterAt", () => {
  const positions = letterPositions(4, 10);

  it("finds the tile under a point", () => {
    expect(letterAt({ x: 9, y: 1 }, positions, 4)).toBe(1);
  });

  it("is null between tiles", () => {
    expect(letterAt({ x: 5, y: 5 }, positions, 4)).toBeNull();
  });
});

describe("extendChain", () => {
  it("starts a chain", () => {
    expect(extendChain([], 2)).toEqual([2]);
  });

  it("ignores the tile it is already on", () => {
    expect(extendChain([2], 2)).toEqual([2]);
  });

  it("adds a new tile", () => {
    expect(extendChain([2, 0], 1)).toEqual([2, 0, 1]);
  });

  it("backs up when dragged to the previous tile", () => {
    expect(extendChain([2, 0, 1], 0)).toEqual([2, 0]);
  });

  it("ignores a tile used earlier in the chain", () => {
    expect(extendChain([2, 0, 1], 2)).toEqual([2, 0, 1]);
  });

  it("treats two tiles holding the same letter as different tiles", () => {
    // Wheel LETTER: tiles 0..5 = L E T T E R. Tiles 2 and 3 are both T.
    expect(extendChain([1, 2], 3)).toEqual([1, 2, 3]);
  });
});

describe("shuffled", () => {
  it("is deterministic for a given random", () => {
    expect(shuffled(["A", "B", "C"], () => 0)).toEqual(["B", "C", "A"]);
  });

  it("keeps the same letters and leaves the input alone", () => {
    const input = ["L", "E", "T", "T", "E", "R"];
    const out = shuffled(input);
    expect([...out].sort()).toEqual([...input].sort());
    expect(input).toEqual(["L", "E", "T", "T", "E", "R"]);
  });
});
