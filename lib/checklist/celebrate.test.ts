import { describe, expect, it } from "vitest";
import {
  CELEBRATE_EVENT,
  celebrate,
  celebrationSoundEnabled,
  setCelebrationSound,
  type CelebrateDetail,
} from "@/lib/checklist/celebrate";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe("celebrate", () => {
  it("fires one event carrying the amount", () => {
    const target = new EventTarget();
    const seen: CelebrateDetail[] = [];
    target.addEventListener(CELEBRATE_EVENT, (e) =>
      seen.push((e as CustomEvent<CelebrateDetail>).detail),
    );
    celebrate(500, target);
    expect(seen).toEqual([{ amount: 500 }]);
  });
  it("says nothing for no profit", () => {
    const target = new EventTarget();
    let count = 0;
    target.addEventListener(CELEBRATE_EVENT, () => (count += 1));
    celebrate(0, target);
    celebrate(-5, target);
    expect(count).toBe(0);
  });
});

describe("celebration sound setting", () => {
  it("is on until turned off, and remembers it", () => {
    const storage = memoryStorage();
    expect(celebrationSoundEnabled(storage)).toBe(true);
    setCelebrationSound(false, storage);
    expect(celebrationSoundEnabled(storage)).toBe(false);
    setCelebrationSound(true, storage);
    expect(celebrationSoundEnabled(storage)).toBe(true);
  });
  it("stays on when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(celebrationSoundEnabled(broken)).toBe(true);
    expect(() => setCelebrationSound(false, broken)).not.toThrow();
  });
});
