"use client";

import { LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

// The animation features load after first paint instead of with every page.
// domMax, not domAnimation: the swipe rows use drag.
const loadMotionFeatures = () =>
  import("framer-motion").then((mod) => mod.domMax);

/** Every `m.*` in the app gets its features here; a stray `motion.*` throws. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      {children}
    </LazyMotion>
  );
}
