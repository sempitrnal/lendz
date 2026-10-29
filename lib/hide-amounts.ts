import { useSyncExternalStore } from "react";

/**
 * One "hide amounts" switch for the whole app: the dashboard's eye and the
 * borrower page's eye flip the same stored value, so hiding on one hides on
 * the other.
 */
const HIDE_KEY = "dashboard-hide-amounts";
const HIDE_EVENT = "dashboard-hide-amounts-changed";

function subscribe(onChange: () => void) {
  window.addEventListener(HIDE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(HIDE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** [hidden, toggle]; renders as shown on the server and until hydrated. */
export function useHideAmounts(): [boolean, () => void] {
  const hide = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    try {
      localStorage.setItem(HIDE_KEY, hide ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(HIDE_EVENT));
  };
  return [hide, toggle];
}

/** The text an amount shows as while amounts are hidden. */
export const HIDDEN_AMOUNT = "••••••";
