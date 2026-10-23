/**
 * How far a bottom sheet must lift when the on-screen keyboard is up. On
 * iPhones (and Chrome on Android) the keyboard shrinks the *visible* area but
 * not the page, so a sheet fixed to the bottom ends up behind it.
 *
 * Returns null with no keyboard. A change under 100px is the browser's own bar
 * showing or hiding, not a keyboard.
 */

const KEYBOARD_MIN_PX = 100;
/** Breathing room kept above the sheet's top edge. */
const TOP_GAP_PX = 16;

export function keyboardInset(view: {
  innerHeight: number;
  vvHeight: number;
  vvOffsetTop: number;
}): { bottom: number; maxHeight: number } | null {
  const bottom = Math.round(
    view.innerHeight - view.vvHeight - view.vvOffsetTop,
  );
  if (bottom < KEYBOARD_MIN_PX) return null;
  return {
    bottom,
    maxHeight: Math.max(0, Math.round(view.vvHeight - TOP_GAP_PX)),
  };
}
