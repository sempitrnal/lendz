"use client";

import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  blendHeight,
  dotProgress,
  paneOneVars,
  paneProgress,
  paneTwoVars,
  pagerWidths,
  tileProgress,
} from "@/lib/account-card/swipe-progress";

/** Put on an element with `data-swipe="tile"`; SwipePanes sets its `--t`. */
export const swipeTileStyle: CSSProperties = {
  opacity: "var(--t, 1)",
  transform:
    "translateY(calc((1 - var(--t, 1)) * 36px)) scale(calc(0.7 + 0.3 * var(--t, 1))) rotate(calc((1 - var(--t, 1)) * -6deg))",
};

/** Put on an element with `data-swipe="dot"`; SwipePanes sets its `--t`. */
export const swipeDotStyle: CSSProperties = {
  opacity: "var(--t, 1)",
  transform: "scale(var(--t, 1))",
};

const paneOneStyle: CSSProperties = {
  opacity: "var(--o, 1)",
  transform:
    "translateX(calc((1 - var(--o, 1)) * -48px)) scale(calc(0.9 + 0.1 * var(--o, 1)))",
};

const paneTwoStyle: CSSProperties = {
  transform: "translateX(calc((1 - var(--i, 1)) * 40px))",
};

/**
 * Two (or one) panes side by side, snapping horizontally. The browser's own
 * scrolling drives the motion; a scroll listener turns how far it has gone
 * into CSS variables and the track's height, so the card grows or shrinks
 * with the finger instead of keeping the taller pane's height.
 */
export function SwipePanes({
  panes,
  labels,
  className = "",
}: {
  panes: ReactNode[];
  labels: string[];
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pagerRefs = useRef<(HTMLElement | null)[]>([]);
  const swipeable = panes.length > 1;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!swipeable || !root || !track) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = media.matches;
    let progress = 0;
    let heights: [number, number] = [0, 0];
    let tiles: HTMLElement[] = [];
    let dots: HTMLElement[] = [];
    let frame = 0;

    const apply = () => {
      const p = progress;
      root.style.setProperty("--o", String(paneOneVars(p, reduce).o));
      root.style.setProperty("--i", String(paneTwoVars(p, reduce).i));
      tiles.forEach((el, i) =>
        el.style.setProperty("--t", String(tileProgress(p, i, reduce))),
      );
      dots.forEach((el, i) =>
        el.style.setProperty("--t", String(dotProgress(p, i, reduce))),
      );
      track.style.height = `${blendHeight(heights[0], heights[1], p, reduce)}px`;
      const widths = pagerWidths(p);
      pagerRefs.current.forEach((el, i) => {
        if (!el) return;
        el.style.width = `${widths[i]}px`;
        el.dataset.active = String((i === 0) === p < 0.5);
      });
    };

    const measure = () => {
      const [first, second] = paneRefs.current;
      if (!first || !second) return;
      // Later panes start at height 0 so the server HTML is as tall as the
      // first pane; hand them their natural height now.
      second.style.height = "";
      heights = [first.offsetHeight, second.offsetHeight];
      tiles = [...root.querySelectorAll<HTMLElement>('[data-swipe="tile"]')];
      dots = [...root.querySelectorAll<HTMLElement>('[data-swipe="dot"]')];
      apply();
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        progress = paneProgress(track.scrollLeft, track.clientWidth);
        apply();
      });
    };

    const onResize = () => {
      track.scrollTo({
        left: Math.round(progress) * track.clientWidth,
        behavior: "auto",
      });
    };

    const onMedia = () => {
      reduce = media.matches;
      apply();
    };

    measure();
    const observer = new ResizeObserver(measure);
    paneRefs.current.forEach((el) => el && observer.observe(el));
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    media.addEventListener("change", onMedia);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      media.removeEventListener("change", onMedia);
    };
  }, [swipeable]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const track = trackRef.current;
    if (!track) return;
    e.preventDefault();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollBy({
      left: (e.key === "ArrowRight" ? 1 : -1) * track.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  if (!swipeable) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <div role="group" aria-label={labels[0]}>
          {panes[0]}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={className}>
      <div
        ref={trackRef}
        role="group"
        aria-roledescription="carousel"
        aria-label="Account details"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex snap-x snap-mandatory items-start overflow-x-auto
          overflow-y-hidden overscroll-x-contain [scrollbar-width:none]
          focus-visible:outline-2 focus-visible:-outline-offset-2
          focus-visible:outline-blue-500 [&::-webkit-scrollbar]:hidden"
      >
        {panes.map((pane, i) => (
          <div
            key={i}
            ref={(el) => {
              paneRefs.current[i] = el;
            }}
            role="group"
            aria-label={labels[i]}
            className="w-full flex-none snap-start snap-always"
            style={i === 0 ? undefined : { height: 0 }}
          >
            <div style={i === 0 ? paneOneStyle : paneTwoStyle}>{pane}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-[5px] pt-0.5 pb-2" aria-hidden>
        {panes.map((_, i) => (
          <i
            key={i}
            ref={(el) => {
              pagerRefs.current[i] = el;
            }}
            data-active={i === 0}
            style={{ width: i === 0 ? 27 : 5 }}
            className="h-[5px] rounded-full bg-slate-300
              data-[active=true]:bg-slate-600 dark:bg-slate-600
              dark:data-[active=true]:bg-slate-300"
          />
        ))}
      </div>
    </div>
  );
}
