/**
 * Builds the level run: LEVEL_COUNT puzzles that get harder slowly, written
 * LEVELS_PER_FILE to a file as public/word-levels/NNN.json. Run by hand:
 *
 *   npm run words:levels
 *
 * Levels are seeded by their number, so the same lists always give the same
 * levels. Players keep the words they found on the level they're on, so once
 * the levels ship, only rebuild them if that's fine to lose.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEVEL_COUNT,
  LEVELS_PER_FILE,
  levelFile,
  levelSize,
  type LevelFile,
} from "../../lib/word-game/levels";
import { buildSizedPuzzle, NoPuzzleError } from "./build";
import { buildLists } from "./lists";

const OUT = join("public", "word-levels");
const lists = buildLists();
/** Wheels already used, so a run of levels doesn't repeat one. */
const used = new Set<string>();

const files = new Map<string, LevelFile>();
const failed: number[] = [];
for (let level = 1; level <= LEVEL_COUNT; level += 1) {
  const name = levelFile(level);
  const file = files.get(name) ?? {
    first: (Math.ceil(level / LEVELS_PER_FILE) - 1) * LEVELS_PER_FILE + 1,
    levels: [],
  };
  try {
    file.levels.push(
      buildSizedPuzzle(`level-${level}`, levelSize(level), lists, used),
    );
  } catch (error) {
    if (!(error instanceof NoPuzzleError)) throw error;
    // Out of fresh wheels at this size: allow a repeat rather than a gap.
    try {
      file.levels.push(
        buildSizedPuzzle(`level-${level}`, levelSize(level), lists),
      );
    } catch (again) {
      if (!(again instanceof NoPuzzleError)) throw again;
      failed.push(level);
    }
  }
  files.set(name, file);
}

if (failed.length > 0) {
  console.error(`No puzzle for levels ${failed.slice(0, 10).join(", ")}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
for (const [name, file] of files) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(file));
}
console.log(`Wrote ${files.size} files, ${LEVEL_COUNT} levels.`);
