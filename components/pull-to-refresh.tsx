"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const PULL_THRESHOLD = 72; // px to trigger
const MAX_PULL = 130; // px hard cap
const SNAP_MS = 280; // snap-back / settle duration
const REFRESH_HOLD_MS = 900; // how long to hold loading before snapping back

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  /* Refs for zero-latency drag tracking (no React re-renders during gesture) */
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const rafPendingRef = useRef(false);
  const pendingDistRef = useRef(0);

  /* Keep mutable refs in sync with state so native handlers never use stale closures */
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  const isAtTop = useCallback(() => window.scrollY <= 5, []);

  /* Direct DOM paint via rAF — bypasses React render pipeline */
  const paint = useCallback((d: number, animate = false) => {
    const el = contentRef.current;
    const ind = indicatorRef.current;
    if (!el || !ind) return;

    const t = animate
      ? `transform ${SNAP_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
      : "none";

    el.style.transition = t;
    el.style.transform = `translateY(${d}px)`;

    ind.style.transition = t;
    ind.style.transform = `translateY(${d}px)`;
    ind.style.opacity = d > 0 ? "1" : "0";
  }, []);

  /* Throttled React state update (max once per frame) for UI text/arrow */
  const flushState = useCallback(() => {
    rafPendingRef.current = false;
    const d = pendingDistRef.current;
    distanceRef.current = d;
    setDistance(d);
  }, []);

  const scheduleState = useCallback(
    (d: number) => {
      pendingDistRef.current = d;
      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(flushState);
      }
    },
    [flushState],
  );

  /* Refresh trigger — guarded so repeated pulls while already refreshing are ignored */
  const triggerRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    router.refresh();

    // Hold the pulled position briefly, then snap back
    window.setTimeout(() => {
      paint(0, true);
      scheduleState(0);
      refreshingRef.current = false;
      setRefreshing(false);
    }, REFRESH_HOLD_MS);
  }, [router, paint, scheduleState]);

  /* Touch listeners — attached once, never re-attached */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!isAtTop() || refreshingRef.current) return;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isDraggingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || !isAtTop() || refreshingRef.current) return;

      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const dy = y - startYRef.current;
      const dx = x - startXRef.current;

      // Horizontal-guard: abort if side-scroll dominates
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isDraggingRef.current = false;
        paint(0, true);
        scheduleState(0);
        return;
      }

      if (dy > 0) {
        // Resistance curve: nearly 1:1 for first ~40px, then stiffens
        const damped = Math.min(dy * 0.55 + Math.min(dy, 40) * 0.15, MAX_PULL);
        paint(damped, false);
        scheduleState(damped);
        if (e.cancelable) e.preventDefault();
      } else {
        isDraggingRef.current = false;
        paint(0, true);
        scheduleState(0);
      }
    };

    const onTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      const d = distanceRef.current;
      if (d >= PULL_THRESHOLD && !refreshingRef.current) {
        // Snap to threshold and hold
        paint(PULL_THRESHOLD, true);
        scheduleState(PULL_THRESHOLD);
        triggerRefresh();
      } else {
        // Snap back smoothly
        paint(0, true);
        scheduleState(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isAtTop, paint, scheduleState, triggerRefresh]);

  /* Mouse fallback for desktop testing */
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isAtTop() || refreshingRef.current) return;
      startYRef.current = e.clientY;
      isDraggingRef.current = true;
    },
    [isAtTop],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current || !isAtTop() || refreshingRef.current) return;
      const dy = e.clientY - startYRef.current;
      if (dy > 0) {
        const damped = Math.min(dy * 0.55 + Math.min(dy, 40) * 0.15, MAX_PULL);
        paint(damped, false);
        scheduleState(damped);
      } else {
        isDraggingRef.current = false;
        paint(0, true);
        scheduleState(0);
      }
    },
    [isAtTop, paint, scheduleState],
  );

  const onMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const d = distanceRef.current;
    if (d >= PULL_THRESHOLD && !refreshingRef.current) {
      paint(PULL_THRESHOLD, true);
      scheduleState(PULL_THRESHOLD);
      triggerRefresh();
    } else {
      paint(0, true);
      scheduleState(0);
    }
  }, [paint, scheduleState, triggerRefresh]);

  const canRelease = distance >= PULL_THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Pull indicator — translateY only, no layout-triggering props */}
      <div
        ref={indicatorRef}
        className="pointer-events-none absolute inset-x-0 -top-15 z-40 flex
          flex-col items-center justify-end will-change-transform"
        style={{
          transform: "translateY(0px)",
          opacity: 0,
          transition: "none",
        }}
      >
        <div
          className="mb-1 flex items-center gap-2 rounded-full border
            border-slate-300 bg-white px-3 py-1.5 text-xs font-black uppercase
            tracking-wide text-slate-600 dark:border-border dark:bg-card
            dark:text-foreground"
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowDown
              className={`size-4 transition-transform duration-200
                ${canRelease ? "rotate-180" : ""}`}
            />
          )}
          {refreshing
            ? "Refreshing..."
            : canRelease
              ? "Release to refresh"
              : "Pull to refresh"}
        </div>
      </div>

      {/* Content — translateY only, will-change for GPU compositing */}
      <div
        ref={contentRef}
        className="will-change-transform"
        style={{
          transform: "translateY(0px)",
          transition: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
