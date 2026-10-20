import { describe, expect, it } from "vitest";
import {
  dragPosition,
  isSettled,
  settleTarget,
  startVelocity,
  stepSpring,
} from "./spring";

/** Run a spring to rest in 1/60s frames; returns every position it visited. */
function run(x: number, v: number, target: number) {
  let s = { x, v: startVelocity(x, v, target) };
  const path = [s.x];
  for (let i = 0; i < 600 && !isSettled(s, target); i++) {
    s = stepSpring(s, target, 1000 / 60);
    path.push(s.x);
  }
  return { s, path };
}

describe("stepSpring", () => {
  it("settles on the target from rest without passing it", () => {
    const { s, path } = run(0, 0, 300);
    expect(isSettled(s, 300)).toBe(true);
    expect(Math.max(...path)).toBeLessThanOrEqual(300.01);
  });
  it("never overshoots, however hard the flick", () => {
    const { path } = run(100, 5, 300);
    expect(Math.max(...path)).toBeLessThanOrEqual(300.01);
  });
  it("takes a moment, not a single frame", () => {
    const { path } = run(0, 0, 300);
    expect(path.length).toBeGreaterThan(20);
  });
  it("settles back when released short of the middle", () => {
    const { s } = run(80, 0, 0);
    expect(s.x).toBeCloseTo(0, 0);
  });
});

describe("startVelocity", () => {
  it("keeps a gentle flick toward the target", () => {
    expect(startVelocity(0, 0.05, 300)).toBeCloseTo(50);
  });
  it("caps a flick that would carry past the target", () => {
    expect(startVelocity(290, 5, 300)).toBeLessThan(5000);
    expect(startVelocity(290, 5, 300)).toBeCloseTo(13.04 * 10, 0);
  });
  it("keeps a flick away from the target as is", () => {
    expect(startVelocity(100, -0.4, 300)).toBeCloseTo(-400);
  });
});

describe("settleTarget", () => {
  it("snaps to the nearer pane when released slowly", () => {
    expect(settleTarget(100, 0, 300)).toBe(0);
    expect(settleTarget(200, 0, 300)).toBe(300);
  });
  it("follows a flick even from a short drag", () => {
    expect(settleTarget(60, 0.6, 300)).toBe(300);
    expect(settleTarget(240, -0.6, 300)).toBe(0);
  });
});

describe("dragPosition", () => {
  it("follows the finger and stops at the ends", () => {
    expect(dragPosition(0, -100, 300)).toBe(100);
    expect(dragPosition(0, 50, 300)).toBe(0);
    expect(dragPosition(300, -80, 300)).toBe(300);
  });
});
