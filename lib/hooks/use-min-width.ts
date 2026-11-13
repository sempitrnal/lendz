import { useCallback, useSyncExternalStore } from "react";

/**
 * True when the window is at least `px` wide; false on the server and until
 * the page has hydrated, so the phone layout is what renders first.
 * Pages use it to swap in a view built for a tablet or a laptop.
 */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** A tablet or anything wider: room for tables and side panels. */
export const TABLET_PX = 768;
