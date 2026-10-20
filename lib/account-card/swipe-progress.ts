/**
 * Maths for the account card's swipe. Progress `p` runs from 0 (first pane)
 * to 1 (second pane); each helper turns it into one animated value.
 */

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** How far the track is scrolled, in panes. */
export function paneProgress(scrollLeft: number, paneWidth: number): number {
  if (paneWidth <= 0) return 0;
  return clamp01(scrollLeft / paneWidth);
}

/** The track's height between the two panes' own heights. */
export function blendHeight(
  h0: number,
  h1: number,
  p: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return p < 0.5 ? h0 : h1;
  return h0 + (h1 - h0) * p;
}

/** First pane's content: fully shown at 0, gone by p = 1/1.6. */
export function paneOneVars(p: number, reduceMotion: boolean): { o: number } {
  return { o: reduceMotion ? 1 : 1 - Math.min(1, p * 1.6) };
}

/** Second pane's content: arrives a little ahead of the finger. */
export function paneTwoVars(p: number, reduceMotion: boolean): { i: number } {
  return { i: reduceMotion ? 1 : Math.min(1, p * 1.2) };
}

/** Stat tiles arrive one after another. */
export function tileProgress(
  p: number,
  index: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return 1;
  return clamp01(p * 1.6 - index * 0.18);
}

/** Schedule dots pop in later than the tiles. */
export function dotProgress(
  p: number,
  index: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return 1;
  return clamp01(p * 2 - 0.6 - index * 0.12);
}

/** Pager dot widths in px: the active one is a pill. */
export function pagerWidths(p: number): [number, number] {
  return [5 + 22 * (1 - p), 5 + 22 * p];
}
