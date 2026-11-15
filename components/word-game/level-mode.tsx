"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  ArrowRight,
  Coins,
  Lightbulb,
  Shuffle,
  Sparkles,
  Star,
  WholeWord,
} from "lucide-react";

import {
  AnimatedLine,
  SpelledWord,
} from "@/components/word-game/animated-line";
import { CrosswordGrid } from "@/components/word-game/crossword-grid";
import { LetterWheel } from "@/components/word-game/letter-wheel";
import { LoadError, Message } from "@/components/word-game/message";
import { useArcade } from "@/components/word-game/use-arcade";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  LETTER_HINT_COST,
  WORD_HINT_COST,
  buyLetter,
  buyWord,
  comboMultiplier,
  levelCoins,
  nextCombo,
  nextLevel,
  recordWord,
  wordCoins,
  wordToReveal,
} from "@/lib/word-game/arcade";
import {
  BIG_EVERY,
  goldenLetter,
  isBigLevel,
  isEndless,
} from "@/lib/word-game/levels";
import {
  clearLevelCache,
  loadLevelOnClient,
  prefetchLevel,
} from "@/lib/word-game/load-level";
import type { LoadResult } from "@/lib/word-game/load-puzzle";
import {
  addBonus,
  addFound,
  pickHintCell,
  revealedCells,
} from "@/lib/word-game/progress";
import { classifyWord, type Puzzle } from "@/lib/word-game/puzzle";
import { shuffled } from "@/lib/word-game/wheel";

/**
 * Levels, one after another: solve one and the next is a tap away. Words pay
 * coins (more in a quick combo, double with the golden letter), coins buy
 * hints, and every BIG_EVERY levels is a bigger one that closes a chapter.
 */
export function LevelMode() {
  const { state } = useArcade();
  const level = state.level;
  const [attempt, setAttempt] = useState(0);
  const promise = useMemo(() => {
    void attempt;
    return loadLevelOnClient(level);
  }, [level, attempt]);

  // The next level's file, so moving on is instant.
  useEffect(() => prefetchLevel(level + 1), [level]);

  return (
    <Suspense fallback={<Message>loading level {level}…</Message>}>
      <LevelView
        key={level}
        promise={promise}
        level={level}
        onRetry={() => {
          clearLevelCache();
          setAttempt((a) => a + 1);
        }}
      />
    </Suspense>
  );
}

function LevelView({
  promise,
  level,
  onRetry,
}: {
  promise: Promise<LoadResult> | null;
  level: number;
  onRetry(): void;
}) {
  if (!promise) return <Message>loading level {level}…</Message>;
  const result = use(promise);
  if (result.status !== "ok") return <LoadError onRetry={onRetry} />;
  return (
    <m.div
      initial={{ opacity: 0, x: 48, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <LevelBoard puzzle={result.puzzle} level={level} />
    </m.div>
  );
}

/** The time, read when a word is spelled (for the combo window). */
const clock = () => Date.now();

function LevelBoard({ puzzle, level }: { puzzle: Puzzle; level: number }) {
  const { state, update } = useArcade();
  const progress = state.progress;
  const golden = goldenLetter(level, puzzle);
  const [letters, setLetters] = useState(() => puzzle.letters.split(""));
  const [current, setCurrent] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [justFound, setJustFound] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const combo = useRef<{ count: number; at: number | null }>({
    count: 0,
    at: null,
  });
  const [comboShown, setComboShown] = useState(0);

  const revealed = revealedCells(puzzle, progress);
  const left = puzzle.words.filter((w) => !progress.found.includes(w.word));
  const letterCell = pickHintCell(puzzle, progress);
  const wordTarget = wordToReveal(puzzle, progress);
  const chapterEnd = isBigLevel(level);

  function flash(text: string) {
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 1400);
  }

  function reject(text: string) {
    setShakeKey((k) => k + 1);
    combo.current = { count: 0, at: null };
    setComboShown(0);
    flash(text);
    triggerHaptic("error");
  }

  function celebrate() {
    triggerHaptic("success");
    void import("canvas-confetti").then(({ default: confetti }) =>
      confetti({
        particleCount: chapterEnd ? 220 : 120,
        spread: chapterEnd ? 110 : 80,
        origin: { y: 0.5 },
        disableForReducedMotion: true,
      }),
    );
  }

  function onSubmit(word: string) {
    const w = word.toUpperCase();
    if (progress.solved) return;
    const kind = classifyWord(puzzle, w);
    if (kind === "invalid") return reject("not a word");
    const seen = kind === "grid" ? progress.found : progress.bonus;
    if (seen.includes(w)) return reject("already found");

    const now = clock();
    const count = nextCombo(combo.current.count, combo.current.at, now);
    combo.current = { count, at: now };
    setComboShown(count);
    const coins = wordCoins(w, kind, count, golden);
    const nextProgress =
      kind === "grid" ? addFound(puzzle, progress, w) : addBonus(progress, w);
    update((s) =>
      recordWord(s, {
        puzzle,
        progress: nextProgress,
        word: w,
        kind,
        coins,
        combo: count,
      }),
    );

    const gold = golden && w.includes(golden) ? " · golden x2" : "";
    const multi =
      comboMultiplier(count) > 1 ? ` · combo x${comboMultiplier(count)}` : "";
    if (kind === "grid") {
      setJustFound(w);
      if (nextProgress.solved) return celebrate();
      flash(`+${coins}${multi}${gold}`);
      triggerHaptic("success");
    } else {
      flash(`bonus +${coins}${multi}${gold}`);
      triggerHaptic("light");
    }
  }

  function hintLetter() {
    if (!letterCell) return;
    let ok = false;
    update((s) => {
      const next = buyLetter(s, letterCell);
      ok = next !== null;
      return next ?? s;
    });
    if (!ok) return reject(`need ${LETTER_HINT_COST} coins`);
    triggerHaptic("light");
  }

  function hintWord() {
    if (!wordTarget) return;
    let ok = false;
    update((s) => {
      const next = buyWord(s, puzzle);
      ok = next !== null;
      return next ?? s;
    });
    if (!ok) return reject(`need ${WORD_HINT_COST} coins`);
    triggerHaptic("light");
  }

  const line = current ? (
    <SpelledWord
      word={current}
      className={cn(
        `rounded-full px-4 py-0.5 text-lg font-black tracking-widest text-white
          lowercase transition-colors`,
        golden && current.toUpperCase().includes(golden)
          ? "bg-amber-500"
          : "bg-emerald-600",
      )}
    />
  ) : note ? (
    <span className="truncate text-sm font-black wg-out">{note}</span>
  ) : comboShown >= 2 ? (
    <m.span
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 0.9, repeat: Infinity }}
      className="text-xs font-black text-amber-600 dark:text-amber-300
        [[data-wg=green]_&]:text-amber-200"
    >
      combo {comboShown} · keep going!
    </m.span>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className="relative flex min-h-0 flex-1 flex-col rounded-2xl wg-card
          p-3"
      >
        {/* What this level is: number, chapter, golden letter, words left. */}
        <div className="mb-1 flex shrink-0 flex-wrap items-center gap-1.5">
          <span className="text-sm font-black text-card-foreground/85">
            level {level}
          </span>
          {chapterEnd && (
            <span
              className="flex items-center gap-1 rounded-full bg-violet-100 px-2
                py-0.5 text-[10px] font-black text-violet-700
                dark:bg-violet-500/20 dark:text-violet-200"
            >
              <Star className="size-3" aria-hidden="true" />
              big level
            </span>
          )}
          {isEndless(level) && (
            <span
              className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px]
                font-black text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
            >
              endless
            </span>
          )}
          {golden && (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px]
                font-black text-amber-800 dark:bg-amber-500/20
                dark:text-amber-200"
            >
              golden {golden.toLowerCase()} · x2
            </span>
          )}
          <span className="ml-auto text-[11px] font-bold wg-muted tabular-nums">
            {left.length} word{left.length === 1 ? "" : "s"} left
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <CrosswordGrid
            puzzle={puzzle}
            revealed={revealed}
            justFound={justFound}
          />
        </div>

        <AnimatePresence>
          {progress.solved && (
            <SolvedCard
              level={level}
              coins={levelCoins(puzzle)}
              chapterEnd={chapterEnd}
              onNext={() => {
                triggerHaptic("light");
                update(nextLevel);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex h-10 shrink-0 items-center gap-2">
        <span
          className="shrink-0 rounded-full wg-chip px-3 py-1.5 text-center
            text-xs font-bold tabular-nums"
        >
          bonus {progress.bonus.length}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <AnimatedLine
            id={
              current
                ? "word"
                : note
                  ? `note-${note}`
                  : comboShown >= 2
                    ? `combo-${comboShown}`
                    : "none"
            }
          >
            {line}
          </AnimatedLine>
        </div>
        <span data-tour="game-hints" className="flex shrink-0 gap-2">
          <HintButton
            label="Hint: reveal a letter"
            cost={LETTER_HINT_COST}
            disabled={!letterCell || progress.solved}
            onClick={hintLetter}
          >
            <Lightbulb className="size-4" />
          </HintButton>
          <HintButton
            label="Hint: reveal the shortest word"
            cost={WORD_HINT_COST}
            disabled={!wordTarget || progress.solved}
            onClick={hintWord}
          >
            <WholeWord className="size-4" />
          </HintButton>
        </span>
      </div>

      <div className="shrink-0" data-tour="game-wheel">
        <LetterWheel
          letters={letters}
          onSubmit={onSubmit}
          onChange={setCurrent}
          shakeKey={shakeKey}
          golden={golden}
        >
          <button
            type="button"
            onClick={() => setLetters((l) => shuffled(l))}
            aria-label="Shuffle letters"
            className="flex size-11 items-center justify-center rounded-full
              wg-accent active:opacity-80"
          >
            <Shuffle className="size-5" />
          </button>
        </LetterWheel>
      </div>
    </div>
  );
}

function HintButton({
  label,
  cost,
  disabled,
  onClick,
  children,
}: {
  label: string;
  cost: number;
  disabled: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <m.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.88 }}
      transition={{ type: "spring", stiffness: 600, damping: 20 }}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${label}, ${cost} coins`}
      className="flex h-10 shrink-0 items-center gap-1 rounded-full wg-hint
        px-2.5 active:opacity-80 disabled:opacity-30"
    >
      {children}
      <span
        className="flex items-center gap-0.5 text-[11px] font-black
          tabular-nums"
      >
        <Coins className="size-3" aria-hidden="true" />
        {cost}
      </span>
    </m.button>
  );
}

function SolvedCard({
  level,
  coins,
  chapterEnd,
  onNext,
}: {
  level: number;
  coins: number;
  chapterEnd: boolean;
  onNext(): void;
}) {
  const chapter = Math.ceil(level / BIG_EVERY);
  const inChapter = ((level - 1) % BIG_EVERY) + 1;
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="absolute inset-x-3 bottom-3 rounded-2xl wg-card p-4 text-center
        shadow-lg ring-1 ring-black/10 backdrop-blur dark:ring-white/15"
    >
      <p
        className="flex items-center justify-center gap-1.5 text-lg font-black
          text-emerald-600 dark:text-emerald-300"
      >
        <Sparkles className="size-5" aria-hidden="true" />
        {chapterEnd ? `chapter ${chapter} done!` : `level ${level} solved!`}
      </p>
      <p className="mt-0.5 text-xs font-bold wg-muted">
        +{coins} coins for the level
      </p>
      {/* How far through the chapter: every BIG_EVERY levels is one. */}
      <div className="mx-auto mt-2 flex max-w-48 gap-1">
        {Array.from({ length: BIG_EVERY }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < inChapter ? "bg-emerald-500" : "bg-muted",
            )}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mx-auto mt-3 flex h-11 items-center gap-1.5 rounded-full
          bg-linear-to-br from-emerald-400 to-emerald-600 px-6 text-sm
          font-black text-white shadow-sm shadow-emerald-500/30 transition
          active:scale-95"
      >
        next level
        <ArrowRight className="size-4" />
      </button>
    </m.div>
  );
}
