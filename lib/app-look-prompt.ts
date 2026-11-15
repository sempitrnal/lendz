import type { AppLook } from "@/lib/app-look";

/**
 * The one-time "pick your look" dialog. Its key names the release, so a later
 * release can ask again with a new key.
 */
export const LOOK_PROMPT_KEY = "app-look-prompt:2026-11-16";

/** The two looks it offers, first is the default. */
export const LOOK_PROMPT_CHOICES: AppLook[] = ["plum-gold", "forest-gold"];

/** Asked this visit, for a browser that won't store anything. */
let askedInMemory = false;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether the dialog still has to be shown on this device. */
export function lookPromptPending(store = storage()): boolean {
  if (askedInMemory) return false;
  try {
    return store?.getItem(LOOK_PROMPT_KEY) == null;
  } catch {
    return false;
  }
}

/** Showing it counts as asking: it doesn't come back. */
export function markLookPromptAsked(store = storage()): void {
  askedInMemory = true;
  try {
    store?.setItem(LOOK_PROMPT_KEY, new Date().toISOString());
  } catch {
    // Not saved: asked once per visit instead.
  }
}

/** Test helper: forget this visit's answer. */
export function resetLookPromptMemory(): void {
  askedInMemory = false;
}
