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
  paneTwoVars,
  pagerWidths,
  tileProgress,
} from "@/lib/account-card/swipe-progress";
import {
  dragPosition,
  isSettled,
  settleTarget,
  startVelocity,
  stepSpring,
  type SpringState,
} from "@/lib/account-card/spring";

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

/** Px of sideways travel before a touch counts as a swipe, not a tap. */
const DRAG_SLOP = 6;

/**
 * Two (or one) panes side by side. A finger drags them 1:1; on release a
 * critically damped spring carries them to the nearer pane (a flick's speed
 * counts), so it eases out smoothly with no bounce. The position drives CSS
 * variables and the track's height, so the card grows or shrinks with the
 * finger instead of keeping the taller pane's height.
 */
export function SwipePanes({
  panes,
  labels,
  className = "",
  onDragStart,
}: {
  panes: ReactNode[];
  labels: string[];
  className?: string;
  /** Called once when a touch turns into a swipe. */
  onDragStart?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pagerRefs = useRef<(HTMLElement | null)[]>([]);
  const goToRef = useRef<(index: number) => void>(() => {});
  const onDragStartRef = useRef(onDragStart);
  const swipeable = panes.length > 1;

  useLayoutEffect(() => {
    onDragStartRef.current = onDragStart;
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const strip = stripRef.current;
    if (!swipeable || !root || !track || !strip) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = media.matches;
    let width = track.clientWidth;
    let pos = 0;
    let index = 0;
    let heights: [number, number] = [0, 0];
    let tiles: HTMLElement[] = [];
    let dots: HTMLElement[] = [];
    let raf = 0;

    const apply = () => {
      const p = width > 0 ? pos / width : 0;
      strip.style.transform = `translate3d(${-pos}px,0,0)`;
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

    const stopAnimation = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const animateTo = (target: number, flick = 0) => {
      stopAnimation();
      index = target > 0 ? 1 : 0;
      if (reduce) {
        pos = target;
        apply();
        return;
      }
      let state: SpringState = {
        x: pos,
        v: startVelocity(pos, flick, target),
      };
      let last = performance.now();
      const frame = (now: number) => {
        state = stepSpring(state, target, now - last);
        last = now;
        if (isSettled(state, target)) {
          pos = target;
          raf = 0;
        } else {
          pos = Math.min(width, Math.max(0, state.x));
          raf = requestAnimationFrame(frame);
        }
        apply();
      };
      raf = requestAnimationFrame(frame);
    };

    goToRef.current = (i) => animateTo(i > 0 ? width : 0);

    // --- dragging -------------------------------------------------------
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startPos = 0;
    let dragging = false;
    let suppressClick = false;
    let samples: { t: number; x: number }[] = [];

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startPos = pos;
      dragging = false;
      samples = [{ t: e.timeStamp, x: e.clientX }];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) < Math.abs(dy)) return;
        dragging = true;
        stopAnimation();
        startPos = pos;
        startX = e.clientX;
        track.setPointerCapture(e.pointerId);
        onDragStartRef.current?.();
        return;
      }
      pos = dragPosition(startPos, e.clientX - startX, width);
      samples.push({ t: e.timeStamp, x: e.clientX });
      if (samples.length > 8) samples.shift();
      apply();
    };

    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 60);
      // Finger speed over roughly the last 100ms; the card moves opposite.
      const end = samples[samples.length - 1];
      const from = samples.find((s) => end.t - s.t <= 100) ?? end;
      const span = end.t - from.t;
      const v = span > 0 ? -(end.x - from.x) / span : 0;
      animateTo(settleTarget(pos, v, width), v);
    };

    // A swipe must not also count as a tap on the card underneath.
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.stopPropagation();
      e.preventDefault();
      suppressClick = false;
    };

    // Tabbing into a pane brings it into view.
    const onFocusIn = (e: FocusEvent) => {
      const i = paneRefs.current.findIndex((el) =>
        el?.contains(e.target as Node),
      );
      if (i >= 0 && i !== index) animateTo(i > 0 ? width : 0);
    };

    // The browser scrolls an overflow:hidden box to reveal a focused child.
    const onTrackScroll = () => {
      track.scrollLeft = 0;
    };

    const onMedia = () => {
      reduce = media.matches;
      apply();
    };

    const trackObserver = new ResizeObserver(() => {
      // Only a change of width (rotation, split screen) re-seats the panes.
      if (track.clientWidth === width) return;
      width = track.clientWidth;
      stopAnimation();
      pos = index * width;
      apply();
    });

    measure();
    const paneObserver = new ResizeObserver(measure);
    paneRefs.current.forEach((el) => el && paneObserver.observe(el));
    trackObserver.observe(track);
    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("click", onClickCapture, true);
    track.addEventListener("focusin", onFocusIn);
    track.addEventListener("scroll", onTrackScroll, { passive: true });
    media.addEventListener("change", onMedia);
    return () => {
      stopAnimation();
      paneObserver.disconnect();
      trackObserver.disconnect();
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", endDrag);
      track.removeEventListener("pointercancel", endDrag);
      track.removeEventListener("click", onClickCapture, true);
      track.removeEventListener("focusin", onFocusIn);
      track.removeEventListener("scroll", onTrackScroll);
      media.removeEventListener("change", onMedia);
      goToRef.current = () => {};
    };
  }, [swipeable]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    goToRef.current(e.key === "ArrowRight" ? 1 : 0);
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
        className="touch-pan-y overflow-hidden select-none
          focus-visible:outline-2 focus-visible:-outline-offset-2
          focus-visible:outline-blue-500"
      >
        <div ref={stripRef} className="flex items-start will-change-transform">
          {panes.map((pane, i) => (
            <div
              key={i}
              ref={(el) => {
                paneRefs.current[i] = el;
              }}
              role="group"
              aria-label={labels[i]}
              className="w-full flex-none"
              style={i === 0 ? undefined : { height: 0 }}
            >
              <div style={i === 0 ? paneOneStyle : paneTwoStyle}>{pane}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center pb-1">
        {panes.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show ${labels[i].toLowerCase()}`}
            onClick={() => goToRef.current(i)}
            className="flex h-6 w-8 items-center justify-center"
          >
            <i
              ref={(el) => {
                pagerRefs.current[i] = el;
              }}
              data-active={i === 0}
              style={{ width: i === 0 ? 27 : 5 }}
              className="h-[5px] rounded-full bg-slate-300
                data-[active=true]:bg-slate-600 dark:bg-slate-600
                dark:data-[active=true]:bg-slate-300"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
