"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TourSpotlight } from "@/components/tours/tour-spotlight";
import {
  markSeen,
  nextTour,
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
  const replayId = useSearchParams().get("tour");
  const [active, setActive] = useState<Active | null>(null);
  // Tours finished or skipped this visit, so a replay (whose `?tour` param is
  // removed on close) is not started again as a normal first-time tour.
  const closed = useRef(new Set<string>());

  useEffect(() => {
    const replayTour = tourById(TOURS, replayId);
    const replay = !!replayTour && replayTour.page === pathname;
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

    return () => {
      clearInterval(timer);
      // Leaving the page closes the tour without marking it seen.
      setActive(null);
    };
  }, [pathname, replayId]);

  if (!active) return null;

  const close = () => {
    closed.current.add(active.tour.id);
    if (!active.replay) markSeen(active.tour.id);
    else {
      // So a reload doesn't replay it again.
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
      onSkip={close}
    />
  );
}
