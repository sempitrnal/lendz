/**
 * The swipe card's drag and settle. Positions are px from the first pane
 * (0 to the pane width); the release is a critically damped spring, so it
 * eases in and out with no bounce.
 */

const STIFFNESS = 170;
const DAMPING = 2 * Math.sqrt(STIFFNESS);
/** Natural frequency: the fastest a critically damped spring can close in. */
const OMEGA = Math.sqrt(STIFFNESS);
/** How far ahead a flick looks when choosing a pane, in ms. */
const PROJECTION_MS = 180;
const MAX_STEP_S = 1 / 120;

export type SpringState = { x: number; v: number };

/** Where the card sits while a finger drags it; it stops at the ends. */
export function dragPosition(
  startPos: number,
  dx: number,
  width: number,
): number {
  return Math.min(width, Math.max(0, startPos - dx));
}

/** Which pane a release settles on. `v` is px/ms, positive toward pane two. */
export function settleTarget(pos: number, v: number, width: number): number {
  return pos + v * PROJECTION_MS > width / 2 ? width : 0;
}

/**
 * The spring's starting speed in px/s from a release speed in px/ms, capped so
 * a hard flick can't carry it past the target.
 */
export function startVelocity(
  pos: number,
  vPerMs: number,
  target: number,
): number {
  const toward = Math.sign(target - pos) || 1;
  const v = vPerMs * 1000;
  const cap = OMEGA * Math.abs(target - pos);
  return v * toward > cap ? cap * toward : v;
}

/** Advance the spring by `dtMs`, in small steps so it stays stable. */
export function stepSpring(
  state: SpringState,
  target: number,
  dtMs: number,
): SpringState {
  let { x, v } = state;
  let remaining = Math.min(dtMs, 64) / 1000;
  while (remaining > 0) {
    const dt = Math.min(remaining, MAX_STEP_S);
    v += (-STIFFNESS * (x - target) - DAMPING * v) * dt;
    x += v * dt;
    remaining -= dt;
  }
  return { x, v };
}

export function isSettled(state: SpringState, target: number): boolean {
  return Math.abs(state.x - target) < 0.4 && Math.abs(state.v) < 5;
}
