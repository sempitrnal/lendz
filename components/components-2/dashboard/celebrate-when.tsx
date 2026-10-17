"use client";

import { useEffect } from "react";

/**
 * Fires a small confetti burst the first time `when` is true for `onceKey`
 * in this browser session. Skipped entirely for reduced-motion users.
 */
export function CelebrateWhen({
  when,
  onceKey,
}: {
  when: boolean;
  onceKey: string;
}) {
  useEffect(() => {
    if (!when) return;
    const key = `celebrated:${onceKey}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: celebrating every visit is fine.
    }
    let cancelled = false;
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.4 },
        disableForReducedMotion: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [when, onceKey]);

  return null;
}
