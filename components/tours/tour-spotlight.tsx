"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type { Tour, TourStep } from "@/lib/tours/logic";

const PAD = 6;
const GAP = 14;
const MARGIN = 16;

type Box = { top: number; left: number; width: number; height: number };

/**
 * One step at a time: dims the screen, cuts a hole around the step's target
 * and shows a popup beside it. Taps on the dimmed area do nothing; Escape
 * skips. Sits above the checklist drawers (z-index 9999).
 */
export function TourSpotlight({
  tour,
  steps,
  onFinish,
  onSkip,
}: {
  tour: Tour;
  steps: TourStep[];
  /** `viaTap`: the last step was finished by tapping its target, which may navigate. */
  onFinish(viaTap?: boolean): void;
  onSkip(): void;
}) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [popupHeight, setPopupHeight] = useState(180);
  const popupRef = useRef<HTMLDivElement>(null);
  // Only ever rendered on the client, after the page is up.
  const [reduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const step = steps[index];
  const last = index === steps.length - 1;

  const next = () => (last ? onFinish() : setIndex((i) => i + 1));

  // Track the target: scroll it into view, then follow scroll and resize. A
  // lazy step waits (up to 3 s) for its target to appear, e.g. inside a sheet
  // the previous step's tap opens; a click step moves on when it is tapped.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let detach = () => {};
    const advance = (viaTap = false) =>
      queueMicrotask(() => {
        if (cancelled) return;
        if (last) onFinish(viaTap);
        else setIndex((i) => i + 1);
      });

    const attach = (el: Element) => {
      el.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      });
      // Follow the target every frame: it may be sliding (a sheet opening),
      // scrolling or resizing. Only a changed rectangle re-renders.
      let frame = 0;
      let last: [number, number, number, number] | null = null;
      const track = () => {
        // The list may re-render and replace the element: look it up again.
        const current = document.querySelector(step.target);
        if (!current) {
          frame = requestAnimationFrame(track);
          return;
        }
        const r = current.getBoundingClientRect();
        const now: [number, number, number, number] = [
          r.top,
          r.left,
          r.width,
          r.height,
        ];
        if (!last || now.some((v, i) => v !== last![i])) {
          last = now;
          setBox({
            top: r.top - PAD,
            left: r.left - PAD,
            width: r.width + PAD * 2,
            height: r.height + PAD * 2,
          });
        }
        frame = requestAnimationFrame(track);
      };
      const onClick = (e: MouseEvent) => {
        if ((e.target as Element | null)?.closest?.(step.target)) {
          setTimeout(() => advance(true), 0);
        }
      };
      track();
      if (step.advanceOn === "click") {
        document.addEventListener("click", onClick, true);
      }
      detach = () => {
        cancelAnimationFrame(frame);
        document.removeEventListener("click", onClick, true);
      };
    };

    const found = document.querySelector(step.target);
    if (found) attach(found);
    else if (step.lazy) {
      // Hide the previous step's hole while we wait.
      queueMicrotask(() => !cancelled && setBox(null));
      const started = Date.now();
      timer = setInterval(() => {
        const el = document.querySelector(step.target);
        if (el) {
          clearInterval(timer);
          attach(el);
        } else if (Date.now() - started >= 3000) {
          clearInterval(timer);
          advance();
        }
      }, 100);
    } else {
      // The target went away mid-tour: skip the step.
      advance();
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // The popup only exists once the target has been measured.
  const ready = box !== null;
  useLayoutEffect(() => {
    if (popupRef.current) setPopupHeight(popupRef.current.offsetHeight);
  }, [index, ready]);

  // Focus moves into the popup when it first appears and back when it closes.
  useEffect(() => {
    if (!ready) return;
    const previous = document.activeElement as HTMLElement | null;
    popupRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!box) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(320, vw - MARGIN * 2);
  const below = box.top + box.height + GAP;
  const above = box.top - GAP - popupHeight;
  const wantTop = step.placement === "top";
  const fitsBelow = below + popupHeight <= vh - MARGIN;
  const fitsAbove = above >= MARGIN;
  const useAbove = wantTop ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
  const top = Math.max(
    MARGIN,
    Math.min(useAbove ? above : below, vh - popupHeight - MARGIN),
  );
  const left = Math.max(
    MARGIN,
    Math.min(box.left + box.width / 2 - width / 2, vw - width - MARGIN),
  );
  const motion = reduceMotion ? "" : "transition-all duration-200";

  return createPortal(
    // The root lets taps through; the parts below take them back. (A sheet
    // that is open sets `pointer-events: none` on the page, so they are set
    // explicitly.)
    <div
      data-tour-overlay
      className="pointer-events-none fixed inset-0 z-[10000]"
    >
      {/* Swallows taps on the dimmed screen; a click step leaves its hole open. */}
      {step.advanceOn === "click" ? (
        <>
          <div
            className="pointer-events-auto absolute inset-x-0 top-0"
            style={{ height: Math.max(0, box.top) }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute inset-x-0 bottom-0"
            style={{ top: box.top + box.height }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute left-0"
            style={{
              top: box.top,
              height: box.height,
              width: Math.max(0, box.left),
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute right-0"
            style={{
              top: box.top,
              height: box.height,
              left: box.left + box.width,
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="pointer-events-auto absolute inset-0"
          aria-hidden="true"
        />
      )}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute rounded-xl ${motion}`}
        style={{
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          boxShadow:
            "0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.8)",
        }}
      />
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-label={tour.title}
        tabIndex={-1}
        className={`pointer-events-auto absolute rounded-2xl border
          border-border bg-card p-4 text-card-foreground shadow-xl outline-none
          ${motion}`}
        style={{ top, left, width }}
      >
        <p className="text-xs font-medium text-muted-foreground">
          {tour.title}
        </p>
        <h2 className="mt-0.5 text-base font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {steps.length > 6 ? (
            // Too many for dots: they would push the buttons out of the popup.
            <span
              className="shrink-0 text-xs tabular-nums text-muted-foreground"
            >
              {index + 1} / {steps.length}
            </span>
          ) : (
            <div className="flex shrink-0 gap-1" aria-hidden="true">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`size-1.5 rounded-full ${
                    i === index ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="ml-auto text-sm text-muted-foreground active:opacity-70"
          >
            Skip
          </button>
          {index > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIndex((i) => i - 1)}
            >
              Back
            </Button>
          )}
          {step.advanceOn === "click" ? (
            <span className="text-xs font-medium text-primary">
              Tap it to continue
            </span>
          ) : (
            <Button type="button" size="sm" onClick={next}>
              {last ? "Done" : "Next"}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
