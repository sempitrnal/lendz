import { describe, expect, it, vi } from "vitest";
import {
  PROMPT_KEY,
  hasPlayed,
  readPrompted,
  shouldPrompt,
  writePrompted,
} from "./prompt";
import { emptyProgress } from "./progress";

const TODAY = "2026-11-12";

describe("hasPlayed", () => {
  it("is false with no progress at all", () => {
    expect(hasPlayed(undefined)).toBe(false);
    expect(hasPlayed(emptyProgress)).toBe(false);
  });

  it("is true once a word was found, a bonus word, a hint or a solve", () => {
    expect(hasPlayed({ ...emptyProgress, found: ["PEN"] })).toBe(true);
    expect(hasPlayed({ ...emptyProgress, bonus: ["LAP"] })).toBe(true);
    expect(hasPlayed({ ...emptyProgress, hints: [[0, 0]] })).toBe(true);
    expect(hasPlayed({ ...emptyProgress, solved: true })).toBe(true);
  });
});

describe("shouldPrompt", () => {
  it("prompts when today is unplayed and not yet asked about", () => {
    expect(shouldPrompt({}, TODAY, null)).toBe(true);
  });

  it("does not prompt when today has been played", () => {
    const all = { [TODAY]: { ...emptyProgress, found: ["PEN"] } };
    expect(shouldPrompt(all, TODAY, null)).toBe(false);
  });

  it("does not prompt twice in a day", () => {
    expect(shouldPrompt({}, TODAY, TODAY)).toBe(false);
  });

  it("prompts again the next day", () => {
    expect(shouldPrompt({}, TODAY, "2026-11-11")).toBe(true);
  });

  it("only today's progress counts, not yesterday's", () => {
    const all = { "2026-11-11": { ...emptyProgress, solved: true } };
    expect(shouldPrompt(all, TODAY, null)).toBe(true);
  });
});

describe("readPrompted", () => {
  const stored = (value: string | null) => ({ getItem: () => value });

  it("reads the saved day", () => {
    expect(readPrompted(stored("2026-11-12"))).toBe("2026-11-12");
  });

  it("is null when nothing is saved or the text is not a date", () => {
    expect(readPrompted(stored(null))).toBeNull();
    expect(readPrompted(stored("yesterday"))).toBeNull();
  });

  it("is null when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readPrompted(blocked)).toBeNull();
  });
});

describe("writePrompted", () => {
  it("saves the day under the key and says so", () => {
    const setItem = vi.fn();
    expect(writePrompted(TODAY, { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith(PROMPT_KEY, TODAY);
    expect(PROMPT_KEY).toBe("word-game:prompted");
  });

  it("returns false when saving throws", () => {
    const setItem = () => {
      throw new Error("full");
    };
    expect(writePrompted(TODAY, { setItem })).toBe(false);
  });
});
