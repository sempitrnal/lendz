"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CELEBRATE_EVENT,
  celebrationSoundEnabled,
  type CelebrateDetail,
} from "@/lib/checklist/celebrate";
import { playChaChing, primeAudio } from "@/lib/sound/cha-ching";

const SHOW_MS = 1400;
const SPARKS = 14;
/** Gold and green coins flying out from the middle. */
const COLORS = ["#fbbf24", "#34d399", "#f59e0b", "#10b981"];
/** A partial payment: purple instead of gold and green. */
const PARTIAL_COLORS = ["#c084fc", "#a855f7", "#e9d5ff", "#9333ea"];

const pesoAmount = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Shows "+₱500!" for a moment, with a burst of coins and a cha-ching, when a
 * payment earns profit (see `celebrate`). It never takes a tap.
 */
export function CelebrationHost() {
  const [shown, setShown] = useState<{
    id: number;
    amount: number;
    partial: boolean;
  } | null>(null);
  const count = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Audio can only start from a tap: unlock it on the first touch of the
    // page, so the sound is allowed when the payment finishes later.
    // On every tap, not just the first: iOS puts the audio to sleep when the
    // app is backgrounded, and only a tap wakes it.
    const prime = () => primeAudio();
    window.addEventListener("pointerdown", prime, { capture: true });
    window.addEventListener("touchend", prime, { capture: true });

    const onCelebrate = (event: Event) => {
      const { amount, partial } = (event as CustomEvent<CelebrateDetail>)
        .detail;
      if (celebrationSoundEnabled()) playChaChing(partial ? "partial" : "full");
      count.current += 1;
      setShown({ id: count.current, amount, partial });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShown(null), SHOW_MS);
    };
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      window.removeEventListener("pointerdown", prime, { capture: true });
      window.removeEventListener("touchend", prime, { capture: true });
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
      clearTimeout(timer.current);
    };
  }, []);

  // In the page body, so no parent's transform can move a fixed overlay.
  if (!shown || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[10001] flex items-center
        justify-center"
    >
      <span className="sr-only">
        {shown.partial
          ? "oi! kuwang man!"
          : `₱${pesoAmount(shown.amount)} profit`}
      </span>
      <div
        className={`celebrate-glow absolute inset-0 ${
          shown.partial ? "bg-purple-400/15" : "bg-emerald-400/15"
        }`}
        aria-hidden="true"
      />
      {Array.from({ length: SPARKS }, (_, i) => {
        const angle = (i / SPARKS) * Math.PI * 2 + (i % 2) * 0.2;
        const radius = 110 + (i % 3) * 38;
        return (
          <span
            key={`${shown.id}-${i}`}
            aria-hidden="true"
            className="celebrate-spark absolute size-3.5 rounded-full"
            style={
              {
                backgroundColor: (shown.partial ? PARTIAL_COLORS : COLORS)[
                  i % COLORS.length
                ],
                "--dx": `${Math.round(Math.cos(angle) * radius)}px`,
                "--dy": `${Math.round(Math.sin(angle) * radius)}px`,
                animationDelay: `${(i % 4) * 30}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
      <p
        key={shown.id}
        aria-hidden="true"
        className={`celebrate-text relative rounded-3xl bg-background/90 px-7
          py-3 font-black tracking-tight ${
            shown.partial
              ? `max-w-[88vw] text-center text-4xl text-purple-600
                shadow-[0_12px_44px_rgba(147,51,234,0.4)] dark:text-purple-400`
              : `text-6xl text-emerald-500
                shadow-[0_12px_44px_rgba(16,185,129,0.4)] dark:text-emerald-400`
          }`}
      >
        {shown.partial ? "oi! kuwang man!" : `+₱${pesoAmount(shown.amount)}!`}
      </p>
    </div>,
    document.body,
  );
}
