"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  APP_LOOK_EVENT,
  APP_LOOK_KEY,
  DEFAULT_APP_LOOK,
  isAppLook,
  type AppLook,
} from "@/lib/app-look";

function read(): AppLook {
  const value = document.documentElement.getAttribute("data-look");
  return isAppLook(value) ? value : DEFAULT_APP_LOOK;
}

function subscribe(onChange: () => void) {
  window.addEventListener(APP_LOOK_EVENT, onChange);
  return () => window.removeEventListener(APP_LOOK_EVENT, onChange);
}

/** Reads the colour of a CSS variable on <html>, e.g. the band's `--page-1`. */
export function rootColor(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** The app's look, and a setter that saves it and repaints at once. */
export function useAppLook(): [AppLook, (look: AppLook) => void] {
  const look = useSyncExternalStore(subscribe, read, () => DEFAULT_APP_LOOK);
  const set = useCallback((next: AppLook) => {
    // "classic" has no colours of its own: the plain theme shows through.
    document.documentElement.setAttribute("data-look", next);
    try {
      localStorage.setItem(APP_LOOK_KEY, next);
    } catch {
      // Not saved: it still applies until the page reloads.
    }
    window.dispatchEvent(new Event(APP_LOOK_EVENT));
  }, []);
  return [look, set];
}
