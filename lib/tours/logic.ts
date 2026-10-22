/** Pure logic behind the What's new tours (`components/tours`). */

export type TourStep = {
  /** A `[data-tour="…"]` selector. */
  target: string;
  title: string;
  body: string;
  /** Preferred side of the target for the popup; it flips if it doesn't fit. */
  placement?: "top" | "bottom";
};

export type Tour = {
  /** Unique and stable, e.g. "2026-10-22-checklist"; never reused. */
  id: string;
  title: string;
  /** ISO date of the release. */
  date: string;
  /** Pathname the tour runs on. */
  page: string;
  steps: TourStep[];
};

export const SEEN_KEY = "lendz-tours-seen";

/** The oldest tour for this page that has not been seen. */
export function nextTour(
  tours: Tour[],
  pathname: string,
  seen: string[],
): Tour | null {
  return tours.find((t) => t.page === pathname && !seen.includes(t.id)) ?? null;
}

export function tourById(tours: Tour[], id: string | null): Tour | null {
  if (!id) return null;
  return tours.find((t) => t.id === id) ?? null;
}

/** Steps whose target is on screen; a missing one never leaves a hole. */
export function playableSteps(
  steps: TourStep[],
  exists: (selector: string) => boolean,
): TourStep[] {
  return steps.filter((s) => exists(s.target));
}

const browserStorage = () =>
  typeof window === "undefined" ? undefined : window.localStorage;

export function readSeen(
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
): string[] {
  try {
    const raw = storage?.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function markSeen(
  id: string,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = browserStorage(),
): void {
  try {
    const seen = readSeen(storage);
    if (seen.includes(id)) return;
    storage?.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
  } catch {
    // Storage unavailable: the tour may show again next visit.
  }
}
