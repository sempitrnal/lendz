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
  onFinish(): void;
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

  // Track the target: scroll it into view, then follow scroll and resize.
  useEffect(() => {
    const el = document.querySelector(step.target);
    // The target went away mid-tour: skip the step.
    if (!el) {
      queueMicrotask(() => (last ? onFinish() : setIndex((i) => i + 1)));
      return;
    }
    el.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    const update = () => {
      const r = el.getBoundingClientRect();
      setBox({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useLayoutEffect(() => {
    if (popupRef.current) setPopupHeight(popupRef.current.offsetHeight);
  }, [index]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    popupRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
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
    <div className="fixed inset-0 z-[10000]">
      {/* Swallows taps on the dimmed screen. */}
      <div className="absolute inset-0" aria-hidden="true" />
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
        className={`absolute rounded-2xl border border-border bg-card p-4
          text-card-foreground shadow-xl outline-none ${motion}`}
        style={{ top, left, width }}
      >
        <p className="text-xs font-medium text-muted-foreground">
          {tour.title}
        </p>
        <h2 className="mt-0.5 text-base font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${
                  i === index ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
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
          <Button type="button" size="sm" onClick={next}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
