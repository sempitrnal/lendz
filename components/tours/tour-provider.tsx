"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TourSpotlight } from "@/components/tours/tour-spotlight";
import {
  markSeen,
  nextTour,
  onPage,
  playableSteps,
  readSeen,
  tourById,
  type Tour,
  type TourStep,
} from "@/lib/tours/logic";
import { TOURS } from "@/lib/tours/tours";

const POLL_MS = 200;
const GIVE_UP_MS = 3000;

type Active = { tour: Tour; steps: TourStep[]; replay: boolean };

const exists = (selector: string) => !!document.querySelector(selector);
/** A sheet or dialog is open (the nav drawers stay in the DOM, closed). */
const blocked = () =>
  !!document.querySelector('[role="dialog"][data-state="open"]');

/**
 * Starts the page's next unseen tour (or the one in `?tour=<id>`, a replay)
 * once its targets are on screen. Mounted once in the dashboard layout.
 */
export function TourProvider() {
  const pathname = usePathname();
  const search = useSearchParams();
  const replayId = search.get("tour");
  // Any query change (the checklist's tab, its day) may bring new targets.
  const query = search.toString();
  const [active, setActive] = useState<Active | null>(null);
  // Whether a tour is on screen, for the effect below to read.
  const running = useRef(false);
  useEffect(() => {
    running.current = active !== null;
  }, [active]);
  // Tours finished or skipped this visit, so a replay (whose `?tour` param is
  // removed on close) is not started again as a normal first-time tour.
  const closed = useRef(new Set<string>());

  // Leaving the page closes the tour without marking it seen (a query change,
  // like the checklist's tab, does not: a guide switches tabs itself).
  useEffect(() => () => setActive(null), [pathname]);

  useEffect(() => {
    if (running.current) return;
    const replayTour = tourById(TOURS, replayId);
    const replay = !!replayTour && onPage(replayTour.page, pathname);
    const tour = replay
      ? replayTour
      : nextTour(TOURS, pathname, [...readSeen(), ...closed.current]);
    if (!tour) return;

    // Lists load after the page: wait for every target, then start with
    // whichever turned up (at least one) when the time is up.
    const started = Date.now();
    const timer = setInterval(() => {
      if (blocked()) return;
      const steps = playableSteps(tour.steps, exists);
      const timedOut = Date.now() - started >= GIVE_UP_MS;
      if (
        steps.length === tour.steps.length ||
        (timedOut && steps.length > 0)
      ) {
        clearInterval(timer);
        setActive({ tour, steps, replay });
      } else if (timedOut) {
        clearInterval(timer);
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [pathname, replayId, query]);

  if (!active) return null;

  const close = (viaTap = false) => {
    closed.current.add(active.tour.id);
    if (!active.replay) markSeen(active.tour.id);
    else if (!viaTap) {
      // So a reload doesn't replay it again. (Not after a tap: that tap may be
      // navigating, and changing the address now would cancel it.)
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState(null, "", url);
    }
    setActive(null);
  };

  return (
    <TourSpotlight
      key={active.tour.id}
      tour={active.tour}
      steps={active.steps}
      onFinish={close}
      onSkip={() => close()}
    />
  );
}
