"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { Shuffle, Timer, Trophy, Zap } from "lucide-react";

import { LetterWheel } from "@/components/word-game/letter-wheel";
import { LoadError, Message } from "@/components/word-game/message";
import { useArcade } from "@/components/word-game/use-arcade";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { recordTimeAttack } from "@/lib/word-game/arcade";
import { clearLevelCache, loadRandomLevel } from "@/lib/word-game/load-level";
import { classifyWord, type Puzzle } from "@/lib/word-game/puzzle";
import { shuffled } from "@/lib/word-game/wheel";

/** How long a round lasts. */
const ROUND_MS = 120_000;

type Round =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "playing"; puzzle: Puzzle; endsAt: number }
  | { phase: "done"; puzzle: Puzzle; found: string[]; best: boolean };

/**
 * Two minutes, one big wheel, as many words as you can find (grid or bonus,
 * any valid word). Each word scores a point and pays a coin.
 */
export function TimeAttack() {
  const { state, update } = useArcade();
  const [round, setRound] = useState<Round>({ phase: "idle" });
  const [found, setFound] = useState<string[]>([]);
  const [letters, setLetters] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const foundRef = useRef<string[]>([]);

  async function start() {
    setRound({ phase: "loading" });
    const result = await loadRandomLevel();
    if (result.status !== "ok") {
      clearLevelCache();
      setRound({ phase: "error" });
      return;
    }
    foundRef.current = [];
    setFound([]);
    setLetters(result.puzzle.letters.split(""));
    setNow(Date.now());
    setRound({
      phase: "playing",
      puzzle: result.puzzle,
      endsAt: Date.now() + ROUND_MS,
    });
  }

  // The clock: ticks while playing and ends the round at zero.
  useEffect(() => {
    if (round.phase !== "playing") return;
    const tick = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= round.endsAt) {
        window.clearInterval(tick);
        const score = foundRef.current.length;
        const best = score > state.stats.timeAttackBest;
        update((s) => recordTimeAttack(s, score));
        triggerHaptic("success");
        setRound({
          phase: "done",
          puzzle: round.puzzle,
          found: foundRef.current,
          best,
        });
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [round, state.stats.timeAttackBest, update]);

  function onSubmit(word: string) {
    if (round.phase !== "playing") return;
    const w = word.toUpperCase();
    if (classifyWord(round.puzzle, w) === "invalid") {
      setShakeKey((k) => k + 1);
      triggerHaptic("error");
      return;
    }
    if (foundRef.current.includes(w)) {
      setShakeKey((k) => k + 1);
      return;
    }
    foundRef.current = [w, ...foundRef.current];
    setFound(foundRef.current);
    triggerHaptic("light");
  }

  if (round.phase === "loading") return <Message>shuffling a wheel…</Message>;
  if (round.phase === "error") return <LoadError onRetry={start} />;

  if (round.phase === "idle" || round.phase === "done") {
    const score = round.phase === "done" ? round.found.length : null;
    return (
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center
          gap-3 rounded-2xl wg-card p-5 text-center"
      >
        <m.span
          initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 16 }}
          className="flex size-14 items-center justify-center rounded-full
            bg-linear-to-br from-amber-300 to-orange-500 text-white shadow-md
            shadow-orange-500/30"
        >
          {score !== null && round.phase === "done" && round.best ? (
            <Trophy className="size-7" />
          ) : (
            <Zap className="size-7" />
          )}
        </m.span>
        {score === null ? (
          <>
            <p className="text-lg font-black">time attack</p>
            <p className="max-w-60 text-xs font-semibold wg-muted">
              2 minutes, one big wheel. find as many words as you can. every
              word is a point and a coin.
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl font-black tabular-nums">{score}</p>
            <p className="text-sm font-black wg-muted">
              {round.phase === "done" && round.best
                ? "new best!"
                : `words · +${score} coins`}
            </p>
            {round.phase === "done" && round.found.length > 0 && (
              <p
                className="max-h-24 max-w-72 overflow-y-auto text-xs
                  font-semibold wg-muted"
              >
                {round.found
                  .slice()
                  .reverse()
                  .map((w) => w.toLowerCase())
                  .join(" · ")}
              </p>
            )}
          </>
        )}
        <p className="text-xs font-bold wg-muted tabular-nums">
          best {state.stats.timeAttackBest}
        </p>
        <button
          type="button"
          onClick={() => void start()}
          className="mt-1 flex h-11 items-center gap-1.5 rounded-full
            bg-linear-to-br from-amber-400 to-orange-500 px-6 text-sm font-black
            text-white shadow-sm shadow-orange-500/30 transition
            active:scale-95"
        >
          <Timer className="size-4" />
          {score === null ? "start" : "play again"}
        </button>
      </div>
    );
  }

  const leftMs = Math.max(0, round.endsAt - now);
  const seconds = Math.ceil(leftMs / 1000);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl wg-card p-3">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <m.span
            animate={seconds <= 15 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={
              seconds <= 15 ? { duration: 1, repeat: Infinity } : undefined
            }
            className={cn(
              "flex items-center gap-1 text-2xl font-black tabular-nums",
              seconds <= 15 ? "text-rose-600 dark:text-rose-400" : "",
            )}
          >
            <Timer className="size-5" aria-hidden="true" />
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </m.span>
          <span className="text-2xl font-black tabular-nums">
            <m.span
              key={found.length}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 16 }}
              className="inline-block"
            >
              {found.length}
            </m.span>
            <span className="ml-1 text-xs font-bold wg-muted">words</span>
          </span>
        </div>
        <div
          className="mt-2 h-1.5 shrink-0 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-400
              to-orange-500 transition-[width] duration-200"
            style={{ width: `${(leftMs / ROUND_MS) * 100}%` }}
          />
        </div>
        <div
          className="mt-3 flex min-h-0 flex-1 flex-wrap content-start gap-1.5
            overflow-y-auto"
        >
          {found.map((w) => (
            <m.span
              key={w}
              layout
              initial={{ opacity: 0, scale: 0.4, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 560, damping: 24 }}
              className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs
                font-black text-emerald-800 dark:bg-emerald-500/15
                dark:text-emerald-300"
            >
              {w.toLowerCase()}
            </m.span>
          ))}
          {found.length === 0 && (
            <p className="w-full pt-6 text-center text-xs font-bold wg-muted">
              any word of 3 or more letters counts
            </p>
          )}
        </div>
      </div>
      <div className="flex h-8 shrink-0 items-center justify-center">
        {current && (
          <span
            className="rounded-full bg-orange-500 px-4 py-0.5 text-lg font-black
              tracking-widest text-white lowercase"
          >
            {current}
          </span>
        )}
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
              bg-orange-50 text-orange-600 ring-1 ring-orange-200
              active:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-300
              dark:ring-orange-500/30"
          >
            <Shuffle className="size-5" />
          </button>
        </LetterWheel>
      </div>
    </div>
  );
}
