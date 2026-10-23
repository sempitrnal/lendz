import { useSyncExternalStore } from "react";

/** Wide enough to show Collect and Release side by side: tablets and up. */
const WIDE_QUERY = "(min-width: 768px)";

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
