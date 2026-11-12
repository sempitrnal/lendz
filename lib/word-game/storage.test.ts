import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, readAll, writeAll } from "./storage";
import { emptyProgress } from "./progress";

const stored = (value: string | null) => ({ getItem: () => value });

describe("readAll", () => {
  it("is empty when nothing is saved", () => {
    expect(readAll(stored(null))).toEqual({});
  });

  it("is empty when the saved text is not JSON", () => {
    expect(readAll(stored("not json"))).toEqual({});
  });

  it("is empty when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readAll(blocked)).toEqual({});
  });

  it("reads saved progress", () => {
    const all = {
      "2026-11-12": {
        found: ["PEN"],
        bonus: [],
        hints: [],
        solved: false,
        solvedOn: null,
      },
    };
    expect(readAll(stored(JSON.stringify(all)))).toEqual(all);
  });

  it("reads an entry saved without solvedOn as solved on no day", () => {
    const text = JSON.stringify({
      "2026-11-12": { found: [], bonus: [], hints: [], solved: true },
    });
    expect(readAll(stored(text))["2026-11-12"].solvedOn).toBeNull();
  });

  it("drops an entry whose solvedOn is not a date text or null", () => {
    const text = JSON.stringify({
      "2026-11-12": {
        found: [],
        bonus: [],
        hints: [],
        solved: true,
        solvedOn: 5,
      },
    });
    expect(readAll(stored(text))).toEqual({});
  });

  it("drops a badly shaped entry and keeps the good ones", () => {
    const text = JSON.stringify({
      "2026-11-12": { found: "x" },
      "2026-11-11": { ...emptyProgress, solved: true },
    });
    expect(readAll(stored(text))).toEqual({
      "2026-11-11": { ...emptyProgress, solved: true },
    });
  });
});

describe("writeAll", () => {
  it("saves under the key and says so", () => {
    const setItem = vi.fn();
    const all = { "2026-11-12": { ...emptyProgress } };
    expect(writeAll(all, { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(all));
    expect(STORAGE_KEY).toBe("word-game:v1");
  });

  it("returns false when saving throws", () => {
    const setItem = () => {
      throw new Error("full");
    };
    expect(writeAll({}, { setItem })).toBe(false);
  });
});
