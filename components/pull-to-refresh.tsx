"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtTop = useRef(true);

  const checkAtTop = useCallback(() => {
    isAtTop.current = window.scrollY <= 5;
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", checkAtTop, { passive: true });
    return () => window.removeEventListener("scroll", checkAtTop);
  }, [checkAtTop]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isAtTop.current) return;
      startY.current = e.touches[0].clientY;
      setPulling(true);
    },
    [],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling || !isAtTop.current) return;
      const y = e.touches[0].clientY;
      const d = Math.max(0, y - startY.current);
      const damped = Math.min(d * 0.5, MAX_PULL);
      setDistance(damped);
      if (damped > PULL_THRESHOLD) {
        e.preventDefault();
      }
    },
    [pulling],
  );

  const onTouchEnd = useCallback(() => {
    setPulling(false);
    if (distance >= PULL_THRESHOLD) {
      setRefreshing(true);
      router.refresh();
      setTimeout(() => {
        setRefreshing(false);
        setDistance(0);
      }, 800);
    } else {
      setDistance(0);
    }
  }, [distance, router]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-start justify-center overflow-hidden"
        style={{
          height: distance,
          opacity: Math.min(1, distance / PULL_THRESHOLD),
        }}
      >
        <div className="mt-3 flex items-center gap-2 rounded-full border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] dark:border-zinc-700 dark:bg-slate-800 dark:text-slate-200 dark:shadow-none">
          <RefreshCw
            className={`size-4 ${refreshing ? "animate-spin" : distance >= PULL_THRESHOLD ? "rotate-180" : ""}`}
          />
          {refreshing
            ? "Refreshing..."
            : distance >= PULL_THRESHOLD
              ? "Release to refresh"
              : "Pull to refresh"}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${distance}px)`,
          transition: pulling ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
