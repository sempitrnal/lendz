"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { formatPeso } from "@/lib/dashboard-data";

const formatters = {
  peso: (n: number) => formatPeso(n),
  number: (n: number) => Math.round(n).toLocaleString(),
};

/**
 * Renders the final value on the server, then counts up to it once on mount.
 * Writes straight to the DOM so the tween never re-renders React.
 */
export function CountUp({
  value,
  format = "peso",
}: {
  value: number;
  format?: keyof typeof formatters;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion) return;
    const fmt = formatters[format];
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        el.textContent = fmt(n);
      },
    });
    return () => controls.stop();
  }, [value, format, reduceMotion]);

  return <span ref={ref}>{formatters[format](value)}</span>;
}
