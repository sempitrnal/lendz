import { useSyncExternalStore } from "react";

/**
 * Wide enough to show Collect and Release side by side: laptops and up. A
 * tablet has the sidebar beside the page, which leaves each list too narrow
 * for its cards, so it keeps the phone's one list at a time.
 */
const WIDE_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on a desktop-width window; false on the server and on phones. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}
