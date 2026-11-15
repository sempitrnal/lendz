import { bankLevel, levelFile, type LevelFile } from "./levels";
import type { Puzzle } from "./puzzle";
import type { LoadResult } from "./load-puzzle";

/** Level files already asked for; a failed one is dropped so it can retry. */
const files = new Map<string, Promise<LevelFile | null>>();

function fileFor(name: string, fetchFn: typeof fetch) {
  const cached = files.get(name);
  if (cached) return cached;
  const pending = (async () => {
    try {
      const response = await fetchFn(`/word-levels/${name}.json`);
      if (!response.ok) return null;
      return (await response.json()) as LevelFile;
    } catch {
      return null;
    }
  })();
  files.set(name, pending);
  void pending.then((file) => {
    if (!file) files.delete(name);
  });
  return pending;
}

/**
 * An endless level replays a made one with its wheel turned, so it doesn't
 * look like the level it came from.
 */
function turned(puzzle: Puzzle, level: number): Puzzle {
  const letters = puzzle.letters.split("");
  const by = 1 + (level % Math.max(1, letters.length - 1));
  return {
    ...puzzle,
    letters: [...letters.slice(by), ...letters.slice(0, by)].join(""),
  };
}

/** A level's puzzle. Never rejects: a failure comes back as "error". */
export async function loadLevel(
  level: number,
  fetchFn: typeof fetch = fetch,
): Promise<LoadResult> {
  const from = bankLevel(level);
  const file = await fileFor(levelFile(from), fetchFn);
  if (!file) return { status: "error" };
  const puzzle = file.levels[from - file.first];
  if (!puzzle) return { status: "none" };
  return {
    status: "ok",
    puzzle: from === level ? puzzle : turned(puzzle, level),
  };
}

/** `loadLevel` in a browser; null on the server, which can't fetch a relative URL. */
export function loadLevelOnClient(level: number): Promise<LoadResult> | null {
  if (typeof window === "undefined") return null;
  return loadLevel(level);
}

/** Starts fetching the file a later level is in. */
export function prefetchLevel(level: number, fetchFn: typeof fetch = fetch) {
  void fileFor(levelFile(bankLevel(level)), fetchFn);
}

/** A random made level for time attack: a big wheel from the harder part. */
export async function loadRandomLevel(
  random: () => number = Math.random,
  fetchFn: typeof fetch = fetch,
): Promise<LoadResult> {
  const level = 301 + Math.floor(random() * 700);
  return loadLevel(level, fetchFn);
}

export function clearLevelCache(): void {
  files.clear();
}
