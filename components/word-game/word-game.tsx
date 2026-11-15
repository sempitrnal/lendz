"use client";

import {
  Suspense,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { Coins, Flame, Home, Lightbulb, Palette, Shuffle } from "lucide-react";
import { toast } from "sonner";

import DayPicker from "@/components/day-picker";
import {
  AnimatedLine,
  SpelledWord,
} from "@/components/word-game/animated-line";
import { CrosswordGrid } from "@/components/word-game/crossword-grid";
import { LetterWheel } from "@/components/word-game/letter-wheel";
import ThemeToggle from "@/components/theme-toggle";
import { LevelMode } from "@/components/word-game/level-mode";
import { LookPicker, useLook } from "@/components/word-game/look-picker";
import { LoadError, Message } from "@/components/word-game/message";
import { StatsCard } from "@/components/word-game/stats-card";
import { TimeAttack } from "@/components/word-game/time-attack";
import { updateArcade, useArcade } from "@/components/word-game/use-arcade";
import { cn } from "@/lib/utils";
import { payDaily, payInterest } from "@/lib/word-game/arcade";
import { useWordProgress } from "@/components/word-game/use-word-progress";
import { triggerHaptic } from "@/lib/haptics";
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
 * The daily word page, sized to the screen so it never scrolls: a slim green
 * band with the streak, the day picker, and the puzzle for the chosen day.
 * The grid takes whatever height is left and shrinks to fit. The puzzle loads
 * in `PuzzleView`, which suspends on a promise made here (above the Suspense
 * boundary, so it survives).
 */
const noSubscribe = () => () => {};

export type GameMode = "levels" | "daily" | "time" | "stats";

const MODES: { id: GameMode; label: string }[] = [
  { id: "levels", label: "levels" },
  { id: "daily", label: "daily" },
  { id: "time", label: "time attack" },
  { id: "stats", label: "stats" },
];

export function WordGame({
  date,
  today,
  mode: initialMode = "levels",
}: {
  date: string;
  today: string;
  mode?: GameMode;
}) {
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [look] = useLook();
  const [picking, setPicking] = useState(false);
  // True in the browser (the portal needs `document`), false on the server.
  const portalReady = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const { state: arcade } = useArcade();
  const [attempt, setAttempt] = useState(0);
  const { all } = useWordProgress(date);
  const streak = currentStreak(solvedDates(all), today);
  const puzzle = useMemo(() => {
    void attempt;
    return loadPuzzleOnClient(date);
  }, [date, attempt]);

  // Unspent coins earn interest for each day away: paid on opening the game.
  useEffect(() => {
    let paid = 0;
    updateArcade((s) => {
      const result = payInterest(s, today);
      paid = result.paid;
      return result.state;
    });
    if (paid > 0) {
      toast.success(`your coins earned ${paid} interest`, {
        icon: <Coins className="size-4" />,
      });
    }
  }, [today]);

  // Keep the mode in the address, so a reload or the back button lands here.
  function pick(next: GameMode) {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    if (next !== "daily") url.searchParams.delete("date");
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    // The next month's file, so the page after the 1st is ready.
    prefetchMonth(monthOf(shiftDate(`${monthOf(date)}-28`, 4)));
  }, [date]);

  // The page fits the screen and never scrolls: no rubber-band bounce either
  // (restored when leaving the page).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const before = [
      html.style.overscrollBehavior,
      body.style.overscrollBehavior,
    ];
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overscrollBehavior = before[0];
      body.style.overscrollBehavior = before[1];
    };
  }, []);

  // A portal on <body>: the app wraps pages in a moving layer, and inside it
  // `fixed` would not cover the screen.
  const screen = (
    // Full screen, over the app's own bars (which this page hides): just the
    // game, with a home button back to the dashboard.
    <div
      data-wg={look}
      className="fixed inset-0 z-[60] flex touch-none flex-col overflow-hidden
        wg-screen lowercase"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div
        data-settle-group="band"
        className="relative shrink-0 px-4 pb-9 text-white sm:px-6"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="wg-band absolute inset-0 rounded-b-3xl"
        />
        <div
          className="relative z-20 mx-auto flex max-w-xl items-center
            justify-between gap-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/dashboard"
              aria-label="Home"
              className="flex size-9 shrink-0 items-center justify-center
                rounded-full bg-white/15 transition active:scale-90
                active:bg-white/25"
            >
              <Home className="size-[18px]" />
            </Link>
            <p className="truncate text-sm font-black tracking-tight">
              word game
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {mode === "daily" && (
              <p
                className="flex items-center gap-1 rounded-full bg-white/15
                  px-2.5 py-1 text-xs font-bold tabular-nums"
              >
                <Flame className="size-3.5" aria-hidden="true" />
                {streak}
              </p>
            )}
            <CoinCount coins={arcade.coins} />
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label="Game look"
              className="flex size-9 shrink-0 items-center justify-center
                rounded-full bg-onpage/20 text-onpage transition
                hover:bg-onpage/30 active:scale-90"
            >
              <Palette className="size-4" />
            </button>
            <ThemeToggle onColor />
          </div>
        </div>
        {/* The modes: levels, the daily puzzle, time attack and stats. */}
        <div
          role="tablist"
          aria-label="Game modes"
          className="relative z-20 mx-auto mt-3 grid max-w-xl grid-cols-4 gap-1
            rounded-full bg-white/15 p-1"
        >
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => pick(id)}
              className={cn(
                `relative truncate rounded-full px-1 py-1.5 text-[11px]
                font-black transition-colors duration-200 active:scale-95`,
                mode === id ? "text-emerald-700" : "text-white/85",
              )}
            >
              {/* One white pill that slides to the picked mode. */}
              {mode === id && (
                <m.span
                  layoutId="word-game-mode"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        data-settle
        className="relative z-10 -mt-7 mx-auto flex min-h-0 w-full max-w-xl
          flex-1 flex-col gap-2 px-3 sm:px-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={mode}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            {mode === "levels" && <LevelMode />}
            {mode === "time" && <TimeAttack />}
            {mode === "stats" && <StatsCard date={date} today={today} />}
            {mode === "daily" && (
              <>
                <div className="shrink-0">
                  <DayPicker date={date} today={today} />
                </div>
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
              </>
            )}
          </m.div>
        </AnimatePresence>
      </div>
      <LookPicker open={picking} onClose={() => setPicking(false)} />
    </div>
  );
  return portalReady ? createPortal(screen, document.body) : null;
}

/**
 * The coin count in the band: it pops when it changes, and a "+n" floats up
 * from it when coins come in.
 */
function CoinCount({ coins }: { coins: number }) {
  const [shown, setShown] = useState(coins);
  const [gain, setGain] = useState<{ id: number; n: number } | null>(null);
  if (coins !== shown) {
    // Adjusting state while rendering: the documented way to react to a prop.
    if (coins > shown) setGain({ id: coins, n: coins - shown });
    setShown(coins);
  }
  return (
    <p
      className="relative flex items-center gap-1 rounded-full bg-white/15
        px-2.5 py-1 text-xs font-bold tabular-nums"
      aria-label={`${coins} coins`}
    >
      <Coins className="size-3.5" aria-hidden="true" />
      <m.span
        key={coins}
        initial={{ scale: 1.5, color: "#fde68a" }}
        animate={{ scale: 1, color: "#ffffff" }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
      >
        {coins}
      </m.span>
      <AnimatePresence>
        {gain && (
          <m.span
            key={gain.id}
            aria-hidden="true"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: -22 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            onAnimationComplete={() => setGain(null)}
            className="pointer-events-none absolute right-1 -top-1 text-xs
              font-black text-amber-200"
          >
            +{gain.n}
          </m.span>
        )}
      </AnimatePresence>
    </p>
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
  if (result.status === "error") return <LoadError onRetry={onRetry} />;
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
      if (next.solved) {
        // Solving a day's puzzle pays a coin bonus once.
        updateArcade((s) => payDaily(s, date));
        return celebrate();
      }
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

  // One line under the grid: the word being spelled, else a short note, else
  // the solved summary, else a warning that nothing will be saved.
  const line = current ? (
    <SpelledWord
      word={current}
      className="rounded-full bg-emerald-600 px-4 py-0.5 text-lg font-black
        tracking-widest text-white lowercase"
    />
  ) : note ? (
    <span className="truncate text-sm font-bold wg-out">{note}</span>
  ) : progress.solved ? (
    <span
      className="truncate text-sm font-black text-emerald-600
        dark:text-emerald-300"
    >
      solved! {puzzle.words.length} words
    </span>
  ) : !persistent ? (
    <span className="text-xs font-semibold wg-out">
      this browser won&apos;t save your progress
    </span>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 rounded-2xl wg-card p-3">
        <CrosswordGrid
          puzzle={puzzle}
          revealed={revealed}
          justFound={justFound}
        />
      </div>

      <div className="flex h-10 shrink-0 items-center gap-2">
        <span
          className="w-20 shrink-0 rounded-full wg-chip px-3 py-1.5 text-center
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
                  : progress.solved
                    ? "solved"
                    : "info"
            }
          >
            {line}
          </AnimatedLine>
        </div>
        <button
          type="button"
          disabled={hint === null}
          onClick={() => {
            if (!hint) return;
            update(addHint(progress, hint));
            triggerHaptic("light");
          }}
          aria-label="Hint: reveal a letter"
          className="flex size-10 shrink-0 items-center justify-center
            rounded-full wg-hint active:opacity-80 disabled:opacity-30"
        >
          <Lightbulb className="size-5" />
        </button>
      </div>

      <div className="shrink-0">
        <LetterWheel
          letters={letters}
          onSubmit={onSubmit}
          onChange={setCurrent}
          shakeKey={shakeKey}
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
