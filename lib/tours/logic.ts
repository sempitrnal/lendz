/** Pure logic behind the What's new tours (`components/tours`). */

export type TourStep = {
  /** A `[data-tour="…"]` selector. */
  target: string;
  title: string;
  body: string;
  /** Preferred side of the target for the popup; it flips if it doesn't fit. */
  placement?: "top" | "bottom";
  /** The step moves on when the highlighted element is tapped (it stays tappable). */
  advanceOn?: "click";
  /** The target only appears later (after the previous step's tap), so it isn't needed to start. */
  lazy?: boolean;
};

export type Tour = {
  /** Unique and stable, e.g. "2026-10-22-checklist"; never reused. */
  id: string;
  title: string;
  /** ISO date of the release. */
  date: string;
  /** Pathname the tour runs on; `/borrowers/*` matches any page below it. */
  page: string;
  steps: TourStep[];
  /** `false`: only started on request (a guide), never by itself on a visit. */
  auto?: boolean;
  /** Extra query for Replay, e.g. "tab=release" to open the tab it is on. */
  replayQuery?: string;
};

export const SEEN_KEY = "lendz-tours-seen";

/** Whether a tour's `page` covers this pathname. */
export function onPage(page: string, pathname: string): boolean {
  return page.endsWith("/*")
    ? pathname.startsWith(page.slice(0, -1))
    : page === pathname;
}

/** The oldest tour for this page that has not been seen. */
export function nextTour(
  tours: Tour[],
  pathname: string,
  seen: string[],
): Tour | null {
  return (
    tours.find(
      (t) =>
        t.auto !== false && onPage(t.page, pathname) && !seen.includes(t.id),
    ) ?? null
  );
}

export function tourById(tours: Tour[], id: string | null): Tour | null {
  if (!id) return null;
  return tours.find((t) => t.id === id) ?? null;
}

/** Steps whose target is on screen (or is lazy); a missing one never leaves a hole. */
export function playableSteps(
  steps: TourStep[],
  exists: (selector: string) => boolean,
): TourStep[] {
  return steps.filter((s) => s.lazy || exists(s.target));
}

/** `window.localStorage` itself can throw (blocked site data). */
function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

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
