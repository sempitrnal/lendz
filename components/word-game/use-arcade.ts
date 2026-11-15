"use client";

import { useCallback, useSyncExternalStore } from "react";

import { newArcade, type ArcadeState } from "@/lib/word-game/arcade";
import { ARCADE_KEY, parseArcade } from "@/lib/word-game/arcade-storage";

/**
 * The level run, shared by every component through `localStorage` (like the
 * daily word's progress). When the browser won't store anything it lives in
 * memory for this visit.
 */
const CHANGED = "word-game-arcade-changed";
const SERVER = newArcade();

let cache: { raw: string | null; state: ArcadeState } | null = null;
let memory: ArcadeState | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function snapshot(): ArcadeState {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(ARCADE_KEY);
  } catch {
    raw = null;
  }
  if (!cache || raw !== cache.raw) cache = { raw, state: parseArcade(raw) };
  return cache.state;
}

/** Saves the run; reads the latest first, so updates never step on each other. */
export function updateArcade(change: (state: ArcadeState) => ArcadeState) {
  const next = change(snapshot());
  try {
    localStorage.setItem(ARCADE_KEY, JSON.stringify(next));
    memory = null;
  } catch {
    memory = next;
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function useArcade(): {
  state: ArcadeState;
  update: (change: (state: ArcadeState) => ArcadeState) => void;
} {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  const update = useCallback(
    (change: (state: ArcadeState) => ArcadeState) => updateArcade(change),
    [],
  );
  return { state, update };
}
