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
  const set = useCallback((next: AppLook) => applyAppLook(next), []);
  return [look, set];
}

/** How long the change of look fades for. */
const FADE_MS = 450;

/**
 * Saves a look and repaints the app with it, every colour easing from the
 * old look to the new (the bands' own colours ease through their registered
 * properties). Instant for anyone who asked for reduced motion.
 */
export function applyAppLook(next: AppLook) {
  const root = document.documentElement;
  try {
    // Saved even when it's already showing (the default), so it sticks.
    localStorage.setItem(APP_LOOK_KEY, next);
  } catch {
    // Not saved: it still applies until the page reloads.
  }
  if (root.getAttribute("data-look") === next) return;
  const paint = () => {
    // "classic" has no colours of its own: the plain theme shows through.
    root.setAttribute("data-look", next);
    window.dispatchEvent(new Event(APP_LOOK_EVENT));
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paint();
    return;
  }
  root.classList.add("look-easing");
  paint();
  window.setTimeout(() => root.classList.remove("look-easing"), FADE_MS + 50);
}
