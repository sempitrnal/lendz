import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPuzzleCache,
  loadPuzzleResult,
  prefetchMonth,
} from "./load-puzzle";
import type { MonthFile } from "./puzzle";
import { testPuzzle } from "./test-puzzle";

const month: MonthFile = {
  month: "2026-11",
  puzzles: { "2026-11-12": testPuzzle, "2026-11-13": testPuzzle },
};
const ok = () => new Response(JSON.stringify(month), { status: 200 });

beforeEach(() => clearPuzzleCache());

describe("loadPuzzleResult", () => {
  it("returns the puzzle for a date in the month file", async () => {
    const fetchFn = vi.fn(async () => ok());
    const result = await loadPuzzleResult("2026-11-12", fetchFn);
    expect(result).toEqual({ status: "ok", puzzle: testPuzzle });
    expect(fetchFn).toHaveBeenCalledWith("/word-puzzles/2026-11.json");
  });

  it("is none when the month file does not exist", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 404 }));
    expect(await loadPuzzleResult("2025-01-01", fetchFn)).toEqual({
      status: "none",
    });
  });

  it("is none when the date is not in the file", async () => {
    const fetchFn = vi.fn(async () => ok());
    expect(await loadPuzzleResult("2026-11-30", fetchFn)).toEqual({
      status: "none",
    });
  });

  it("is error when the network fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("offline");
    });
    expect(await loadPuzzleResult("2026-11-12", fetchFn)).toEqual({
      status: "error",
    });
  });

  it("is error on a server failure", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 500 }));
    expect(await loadPuzzleResult("2026-11-12", fetchFn)).toEqual({
      status: "error",
    });
  });

  it("fetches a month once for two dates in it", async () => {
    const fetchFn = vi.fn(async () => ok());
    await loadPuzzleResult("2026-11-12", fetchFn);
    await loadPuzzleResult("2026-11-13", fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("tries again after an error", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("offline");
    });
    expect((await loadPuzzleResult("2026-11-12", failing)).status).toBe(
      "error",
    );
    const working = vi.fn(async () => ok());
    expect((await loadPuzzleResult("2026-11-12", working)).status).toBe("ok");
    expect(working).toHaveBeenCalledTimes(1);
  });
});

describe("prefetchMonth", () => {
  it("warms the cache so a later load does not fetch again", async () => {
    const fetchFn = vi.fn(async () => ok());
    prefetchMonth("2026-11", fetchFn);
    await loadPuzzleResult("2026-11-12", fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
