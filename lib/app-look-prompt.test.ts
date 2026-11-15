import { beforeEach, describe, expect, it } from "vitest";
import {
  LOOK_PROMPT_KEY,
  lookPromptPending,
  markLookPromptAsked,
  resetLookPromptMemory,
} from "@/lib/app-look-prompt";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as unknown as Storage;
}

describe("look prompt", () => {
  beforeEach(() => resetLookPromptMemory());

  it("is pending until it has been shown once", () => {
    const store = memoryStore();
    expect(lookPromptPending(store)).toBe(true);
    markLookPromptAsked(store);
    expect(store.getItem(LOOK_PROMPT_KEY)).not.toBeNull();
    resetLookPromptMemory();
    expect(lookPromptPending(store)).toBe(false);
  });

  it("asks only once a visit when nothing can be stored", () => {
    expect(lookPromptPending(null)).toBe(true);
    markLookPromptAsked(null);
    expect(lookPromptPending(null)).toBe(false);
  });
});
