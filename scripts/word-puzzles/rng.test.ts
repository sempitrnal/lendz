import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "./rng";

const take = (random: () => number, n: number) =>
  Array.from({ length: n }, () => random());

describe("mulberry32", () => {
  it("gives the same sequence for the same seed", () => {
    expect(take(mulberry32(1), 5)).toEqual(take(mulberry32(1), 5));
  });

  it("gives a different sequence for a different seed", () => {
    expect(take(mulberry32(1), 5)).not.toEqual(take(mulberry32(2), 5));
  });

  it("stays in [0, 1)", () => {
    for (const v of take(mulberry32(7), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("is stable and tells dates apart", () => {
    expect(hashString("2026-11-12")).toBe(hashString("2026-11-12"));
    expect(hashString("2026-11-12")).not.toBe(hashString("2026-11-13"));
  });
});
