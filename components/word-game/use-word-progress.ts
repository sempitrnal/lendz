"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  emptyProgress,
  type AllProgress,
  type Progress,
} from "@/lib/word-game/progress";
import { STORAGE_KEY, readAll, writeAll } from "@/lib/word-game/storage";

/**
 * Word game progress, shared by every component through `localStorage`, in the
 * style of `lib/hide-amounts.ts`. When the browser will not store anything, the
 * progress is kept for this visit only and `persistent` turns false.
 */
const CHANGED = "word-game-progress-changed";
const NONE: AllProgress = {};

/** The parsed progress for the raw text last seen, so snapshots stay stable. */
let cache: { raw: string | null; all: AllProgress } = { raw: null, all: NONE };
/** Set once a write failed: from then on this visit's progress lives here. */
let memory: AllProgress | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function snapshot(): AllProgress {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) cache = { raw, all: readAll({ getItem: () => raw }) };
  return cache.all;
}

export function useWordProgress(date: string): {
  all: AllProgress;
  progress: Progress;
  update(next: Progress): void;
  persistent: boolean;
} {
  const all = useSyncExternalStore(subscribe, snapshot, () => NONE);
  const persistent = useSyncExternalStore(
    subscribe,
    () => memory === null,
    () => true,
  );

  const update = useCallback(
    (next: Progress) => {
      const merged = { ...snapshot(), [date]: next };
      if (!writeAll(merged)) memory = merged;
      window.dispatchEvent(new Event(CHANGED));
    },
    [date],
  );

  return { all, progress: all[date] ?? emptyProgress, update, persistent };
}
