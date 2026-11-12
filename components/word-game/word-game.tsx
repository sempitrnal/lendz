"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { Flame, Lightbulb, Shuffle } from "lucide-react";

import DayPicker from "@/components/day-picker";
import { CrosswordGrid } from "@/components/word-game/crossword-grid";
import { LetterWheel } from "@/components/word-game/letter-wheel";
import { useWordProgress } from "@/components/word-game/use-word-progress";
import { triggerHaptic } from "@/lib/haptics";
import { playChaChing, primeAudio } from "@/lib/sound/cha-ching";
import { monthOf, shiftDate } from "@/lib/word-game/date";
import {
  clearPuzzleCache,
  loadPuzzleOnClient,
  prefetchMonth,
  type LoadResult,
} from "@/lib/word-game/load-puzzle";
import {
  addBonus,
  addFound,
  addHint,
  pickHintCell,
  revealedCells,
} from "@/lib/word-game/progress";
import { classifyWord, type Puzzle } from "@/lib/word-game/puzzle";
import { currentStreak, solvedDates } from "@/lib/word-game/streak";
import { shuffled } from "@/lib/word-game/wheel";

/**
 * The daily word page: a green band with the streak, the day picker, and the
 * puzzle for the chosen day. The puzzle loads in `PuzzleView`, which suspends
 * on a promise made here (above the Suspense boundary, so it survives).
 */
export function WordGame({ date, today }: { date: string; today: string }) {
  const [attempt, setAttempt] = useState(0);
  const { all } = useWordProgress(date);
  const streak = currentStreak(solvedDates(all), today);
  const puzzle = useMemo(() => {
    void attempt;
    return loadPuzzleOnClient(date);
  }, [date, attempt]);

  useEffect(() => {
    // The next month's file, so the page after the 1st is ready.
    prefetchMonth(monthOf(shiftDate(`${monthOf(date)}-28`, 4)));
  }, [date]);

  return (
    <div className="pb-16 lowercase">
      <div
        data-settle-group="band"
        className="relative -mt-16 px-4 pt-[4.75rem] pb-14 text-white sm:mt-0
          sm:px-6 sm:pt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <p className="relative z-20 text-xs font-bold tracking-wider uppercase">
          daily word
        </p>
        <div className="relative z-20 mt-4">
          <p className="text-xs font-semibold opacity-80">streak</p>
          <p
            className="flex items-center gap-2 text-[40px] leading-tight
              font-black tracking-tight tabular-nums"
          >
            <Flame className="size-8" aria-hidden="true" />
            {streak}
            <span className="text-base font-bold opacity-80">
              day{streak === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      </div>

      <div data-settle className="relative z-10 -mt-8 space-y-3 px-3 sm:px-6">
        <DayPicker date={date} today={today} />
        <Suspense fallback={<Message>loading the puzzle…</Message>}>
          <PuzzleView
            promise={puzzle}
            date={date}
            today={today}
            onRetry={() => {
              clearPuzzleCache();
              setAttempt((a) => a + 1);
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl bg-card px-4 py-10 text-center text-sm font-bold
        text-muted-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
    >
      {children}
    </div>
  );
}

function PuzzleView({
  promise,
  date,
  today,
  onRetry,
}: {
  /** Null while the server renders: the page shows "loading" until it is in a browser. */
  promise: Promise<LoadResult> | null;
  date: string;
  today: string;
  onRetry(): void;
}) {
  if (!promise) return <Message>loading the puzzle…</Message>;
  const result = use(promise);
  if (result.status === "none")
    return <Message>no puzzle for this day</Message>;
  if (result.status === "error") {
    return (
      <Message>
        <p>couldn&apos;t load, try when online</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-xs
            font-bold text-white active:bg-emerald-700"
        >
          retry
        </button>
      </Message>
    );
  }
  return <Board puzzle={result.puzzle} date={date} today={today} />;
}

function Board({
  puzzle,
  date,
  today,
}: {
  puzzle: Puzzle;
  date: string;
  today: string;
}) {
  const { progress, update, persistent } = useWordProgress(date);
  const [letters, setLetters] = useState(() => puzzle.letters.split(""));
  const [current, setCurrent] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [justFound, setJustFound] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealed = revealedCells(puzzle, progress);
  const hint = pickHintCell(puzzle, progress);

  function flash(text: string) {
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 1200);
  }

  function reject(text: string) {
    setShakeKey((k) => k + 1);
    flash(text);
    triggerHaptic("error");
  }

  function celebrate() {
    playChaChing("full");
    triggerHaptic("success");
    void import("canvas-confetti").then(({ default: confetti }) =>
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        disableForReducedMotion: true,
      }),
    );
  }

  function onSubmit(word: string) {
    const w = word.toUpperCase();
    const kind = classifyWord(puzzle, w);
    if (kind === "grid") {
      if (progress.found.includes(w)) return reject("already found");
      const next = addFound(puzzle, progress, w, today);
      update(next);
      setJustFound(w);
      if (next.solved) return celebrate();
      playChaChing("partial");
      triggerHaptic("success");
    } else if (kind === "bonus") {
      if (progress.bonus.includes(w)) return reject("already found");
      update(addBonus(progress, w));
      flash("bonus word!");
      triggerHaptic("light");
    } else {
      reject("not a word");
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5
          dark:ring-white/10"
      >
        <CrosswordGrid
          puzzle={puzzle}
          revealed={revealed}
          justFound={justFound}
        />
      </div>

      {progress.solved ? (
        <div
          className="rounded-2xl bg-emerald-600 px-4 py-3 text-center text-white
            shadow-sm"
        >
          <p className="text-base font-black">solved!</p>
          <p className="text-xs font-semibold opacity-90">
            {puzzle.words.length} words · {progress.bonus.length} bonus
            {date === today
              ? " · come back tomorrow"
              : " · nice work on this day"}
          </p>
        </div>
      ) : null}

      <div className="flex h-9 items-center justify-center">
        {current ? (
          <span
            className="rounded-full bg-emerald-600 px-4 py-1 text-lg font-black
              tracking-widest text-white uppercase"
          >
            {current}
          </span>
        ) : note ? (
          <span className="text-sm font-bold text-muted-foreground">
            {note}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setLetters((l) => shuffled(l))}
          aria-label="Shuffle letters"
          className="flex size-11 items-center justify-center rounded-full
            bg-card text-emerald-700 shadow-sm ring-1 ring-black/5
            active:bg-muted dark:text-emerald-300 dark:ring-white/10"
        >
          <Shuffle className="size-5" />
        </button>
        <span
          className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold
            text-emerald-800 tabular-nums dark:bg-emerald-500/15
            dark:text-emerald-300"
        >
          bonus {progress.bonus.length}
        </span>
        <button
          type="button"
          disabled={hint === null}
          onClick={() => {
            if (!hint) return;
            update(addHint(progress, hint));
            triggerHaptic("light");
          }}
          aria-label="Hint: reveal a letter"
          className="flex size-11 items-center justify-center rounded-full
            bg-card text-amber-600 shadow-sm ring-1 ring-black/5 active:bg-muted
            disabled:opacity-30 dark:text-amber-300 dark:ring-white/10"
        >
          <Lightbulb className="size-5" />
        </button>
      </div>

      <LetterWheel
        letters={letters}
        onSubmit={onSubmit}
        onChange={setCurrent}
        shakeKey={shakeKey}
        onFirstTouch={primeAudio}
      />

      {!persistent ? (
        <p className="text-center text-xs font-semibold text-muted-foreground">
          this browser won&apos;t save your progress
        </p>
      ) : null}
    </div>
  );
}
