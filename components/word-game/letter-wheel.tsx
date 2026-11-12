"use client";

import { useRef, useState, type PointerEvent } from "react";
import { m, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import {
  extendChain,
  letterAt,
  letterPositions,
  type Point,
} from "@/lib/word-game/wheel";

const SIZE = 264;
const RADIUS = 94;
const TILE = 56;
const HIT = 30;

/**
 * The letter wheel. Press a letter and drag across others to chain them; a
 * line follows the finger; releasing hands the spelled word to `onSubmit`.
 * `shakeKey` going up shakes the wheel (a wrong or repeated word).
 */
export function LetterWheel({
  letters,
  onSubmit,
  onChange,
  shakeKey,
  onFirstTouch,
}: {
  letters: string[];
  onSubmit(word: string): void;
  onChange?(word: string): void;
  shakeKey: number;
  onFirstTouch?(): void;
}) {
  const reduceMotion = useReducedMotion();
  const positions = letterPositions(letters.length, RADIUS);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [chain, setChain] = useState<number[]>([]);
  const [finger, setFinger] = useState<Point | null>(null);

  const spell = (indexes: number[]) => indexes.map((i) => letters[i]).join("");

  function pointOf(e: PointerEvent): Point {
    const rect = box.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    const point = pointOf(e);
    const index = letterAt(point, positions, HIT);
    if (index === null) return;
    onFirstTouch?.();
    dragging.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone: the chain still works without capture.
    }
    setChain([index]);
    setFinger(point);
    onChange?.(spell([index]));
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const point = pointOf(e);
    setFinger(point);
    const index = letterAt(point, positions, HIT);
    if (index === null) return;
    const next = extendChain(chain, index);
    if (next !== chain) {
      setChain(next);
      onChange?.(spell(next));
    }
  }

  function onUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const word = spell(chain);
    setChain([]);
    setFinger(null);
    onChange?.("");
    if (word) onSubmit(word);
  }

  const line = [
    ...chain.map((i) => positions[i]),
    ...(finger && chain.length > 0 ? [finger] : []),
  ];

  return (
    <m.div
      key={shakeKey}
      animate={
        shakeKey > 0 && !reduceMotion ? { x: [0, -9, 9, -6, 6, 0] } : undefined
      }
      transition={{ duration: 0.35 }}
      className="mx-auto"
      style={{ width: SIZE, height: SIZE }}
    >
      <div
        ref={box}
        role="application"
        aria-label="Letter wheel"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative size-full touch-none rounded-full bg-card shadow-sm
          ring-1 ring-black/5 select-none dark:ring-white/10"
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
        >
          <polyline
            points={line.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-500/60"
          />
        </svg>
        {letters.map((letter, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              `pointer-events-none absolute flex items-center justify-center
              rounded-full text-2xl font-black uppercase transition-colors`,
              chain.includes(i)
                ? "bg-emerald-600 text-white"
                : `bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15
                  dark:text-emerald-200`,
            )}
            style={{
              width: TILE,
              height: TILE,
              left: SIZE / 2 + positions[i].x - TILE / 2,
              top: SIZE / 2 + positions[i].y - TILE / 2,
            }}
          >
            {letter}
          </span>
        ))}
      </div>
    </m.div>
  );
}
