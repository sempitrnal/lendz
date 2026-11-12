import { monthOf } from "./date";
import type { MonthFile, Puzzle } from "./puzzle";

export type LoadResult =
  | { status: "ok"; puzzle: Puzzle }
  | { status: "none" }
  | { status: "error" };

type MonthResult =
  | { status: "file"; file: MonthFile }
  | { status: "none" }
  | { status: "error" };

/** Month files already asked for; a failed one is dropped so it can retry. */
const months = new Map<string, Promise<MonthResult>>();

function monthResult(
  month: string,
  fetchFn: typeof fetch,
): Promise<MonthResult> {
  const cached = months.get(month);
  if (cached) return cached;
  const pending = (async (): Promise<MonthResult> => {
    try {
      const response = await fetchFn(`/word-puzzles/${month}.json`);
      if (response.status === 404) return { status: "none" };
      if (!response.ok) return { status: "error" };
      return { status: "file", file: (await response.json()) as MonthFile };
    } catch {
      return { status: "error" };
    }
  })();
  months.set(month, pending);
  void pending.then((result) => {
    if (result.status === "error") months.delete(month);
  });
  return pending;
}

/** The puzzle for a date. Never rejects: failures come back as a status. */
export async function loadPuzzleResult(
  date: string,
  fetchFn: typeof fetch = fetch,
): Promise<LoadResult> {
  const result = await monthResult(monthOf(date), fetchFn);
  if (result.status === "error") return { status: "error" };
  if (result.status === "none") return { status: "none" };
  const puzzle = result.file.puzzles[date];
  return puzzle ? { status: "ok", puzzle } : { status: "none" };
}

/**
 * `loadPuzzleResult` in a browser; null on the server. The server renders this
 * page too, but a relative URL cannot be fetched there, so a load started
 * during server rendering would always come back as an error.
 */
export function loadPuzzleOnClient(
  date: string,
  fetchFn?: typeof fetch,
): Promise<LoadResult> | null {
  if (typeof window === "undefined") return null;
  return loadPuzzleResult(date, fetchFn);
}

/** Starts fetching a month's file so a later load finds it ready. */
export function prefetchMonth(
  month: string,
  fetchFn: typeof fetch = fetch,
): void {
  void monthResult(month, fetchFn);
}

export function clearPuzzleCache(): void {
  months.clear();
}
