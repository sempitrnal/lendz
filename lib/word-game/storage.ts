import type { AllProgress, Progress } from "./progress";

export const STORAGE_KEY = "word-game:v1";

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

function isProgress(v: unknown): v is Progress {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isStringList(p.found) &&
    isStringList(p.bonus) &&
    typeof p.solved === "boolean" &&
    Array.isArray(p.hints) &&
    p.hints.every(
      (h) =>
        Array.isArray(h) &&
        h.length === 2 &&
        typeof h[0] === "number" &&
        typeof h[1] === "number",
    )
  );
}

/** Saved progress for every date; empty when missing, corrupt or blocked. */
export function readAll(
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): AllProgress {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: AllProgress = {};
    for (const [date, value] of Object.entries(parsed)) {
      if (isProgress(value)) out[date] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Saves all progress; false when the browser would not take it. */
export function writeAll(
  all: AllProgress,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
