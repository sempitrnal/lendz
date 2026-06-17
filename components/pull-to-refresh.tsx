"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const startX = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAtTop = useCallback(() => window.scrollY <= 5, []);

  const doRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setRefreshing(false);
      setDistance(0);
    }, 800);
  }, [router]);

  /* Touch events via ref to use non-passive listeners */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!isAtTop() || refreshing) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      isPulling.current = true;
      setPulling(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || !isAtTop() || refreshing) return;
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const dy = y - startY.current;
      const dx = x - startX.current;

      // Abort if horizontal scroll dominates
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isPulling.current = false;
        setDistance(0);
        return;
      }

      if (dy > 0) {
        const damped = Math.min(dy * 0.5, MAX_PULL);
        setDistance(damped);
        if (e.cancelable) e.preventDefault();
      } else {
        isPulling.current = false;
        setDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;
      setPulling(false);
      const d = distance; // capture latest from closure
      if (d >= PULL_THRESHOLD && !refreshing) {
        setDistance(PULL_THRESHOLD);
        doRefresh();
      } else {
        setDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [distance, refreshing, doRefresh, isAtTop]);

  /* Mouse support for desktop testing */
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isAtTop() || refreshing) return;
      startY.current = e.clientY;
      isPulling.current = true;
      setPulling(true);
    },
    [refreshing, isAtTop],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPulling.current || !isAtTop() || refreshing) return;
      const dy = e.clientY - startY.current;
      if (dy > 0) {
        setDistance(Math.min(dy * 0.5, MAX_PULL));
      } else {
        setDistance(0);
      }
    },
    [refreshing, isAtTop],
  );

  const onMouseUp = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    setPulling(false);
    if (distance >= PULL_THRESHOLD && !refreshing) {
      setDistance(PULL_THRESHOLD);
      doRefresh();
    } else {
      setDistance(0);
    }
  }, [distance, refreshing, doRefresh]);

  const indicatorTransition = refreshing
    ? "all 0.2s ease-out"
    : pulling
      ? "none"
      : "all 0.25s ease-out";

  const contentTransition = refreshing
    ? "transform 0.2s ease-out"
    : pulling
      ? "none"
      : "transform 0.25s ease-out";

  const canRelease = distance >= PULL_THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Pull indicator */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-40 flex
          flex-col items-center justify-end overflow-hidden"
        style={{
          height: `${Math.max(0, (refreshing ? PULL_THRESHOLD : distance) + 8)}px`,
          opacity: refreshing || distance > 0 ? 1 : 0,
          transition: indicatorTransition,
        }}
      >
        <div
          className="mb-1 flex items-center gap-2 rounded-full border-2
            border-slate-900 bg-white px-3 py-1.5 text-xs font-black uppercase
            tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]
            dark:border-border dark:bg-card dark:text-foreground
            dark:shadow-none"
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

      {/* Content */}
      <div
        style={{
          transform: `translateY(${refreshing ? PULL_THRESHOLD : distance}px)`,
          transition: contentTransition,
        }}
      >
        {children}
      </div>
    </div>
  );
}
