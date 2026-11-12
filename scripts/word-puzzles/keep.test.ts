import { describe, expect, it } from "vitest";
import { shouldKeep } from "./keep";

const TODAY = "2026-11-12";

describe("shouldKeep", () => {
  it("keeps an existing puzzle for a past date", () => {
    expect(shouldKeep("2026-11-01", TODAY, true, false)).toBe(true);
  });

  it("keeps an existing puzzle for today", () => {
    expect(shouldKeep(TODAY, TODAY, true, false)).toBe(true);
  });

  it("rebuilds a future date even when one exists", () => {
    expect(shouldKeep("2026-11-13", TODAY, true, false)).toBe(false);
  });

  it("rebuilds everything when forced", () => {
    expect(shouldKeep("2026-11-01", TODAY, true, true)).toBe(false);
  });

  it("builds a date that has no puzzle yet", () => {
    expect(shouldKeep("2026-11-01", TODAY, false, false)).toBe(false);
  });
});
