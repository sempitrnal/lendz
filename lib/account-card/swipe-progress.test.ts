import { describe, expect, it } from "vitest";
import {
  blendHeight,
  clamp01,
  dotProgress,
  paneOneVars,
  paneProgress,
  paneTwoVars,
  pagerWidths,
  tileProgress,
} from "./swipe-progress";

describe("clamp01", () => {
  it("keeps values in 0..1", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(3)).toBe(1);
  });
});

describe("paneProgress", () => {
  it("is the share of one pane scrolled", () => {
    expect(paneProgress(160, 320)).toBe(0.5);
  });
  it("clamps outside the track and survives a zero width", () => {
    expect(paneProgress(-20, 320)).toBe(0);
    expect(paneProgress(900, 320)).toBe(1);
    expect(paneProgress(10, 0)).toBe(0);
  });
});

describe("blendHeight", () => {
  it("blends between the two pane heights", () => {
    expect(blendHeight(100, 200, 0.5, false)).toBe(150);
  });
  it("jumps at the halfway point with reduced motion", () => {
    expect(blendHeight(100, 200, 0.49, true)).toBe(100);
    expect(blendHeight(100, 200, 0.5, true)).toBe(200);
  });
});

describe("pane content vars", () => {
  it("fades pane one out by 1/1.6 of the way", () => {
    expect(paneOneVars(0, false).o).toBe(1);
    expect(paneOneVars(1, false).o).toBe(0);
    expect(paneOneVars(0.3, false).o).toBeCloseTo(1 - 0.48);
  });
  it("brings pane two in", () => {
    expect(paneTwoVars(1, false).i).toBe(1);
    expect(paneTwoVars(0.5, false).i).toBeCloseTo(0.6);
  });
  it("does nothing with reduced motion", () => {
    expect(paneOneVars(0.7, true).o).toBe(1);
    expect(paneTwoVars(0.2, true).i).toBe(1);
  });
});

describe("tileProgress and dotProgress", () => {
  it("staggers tiles", () => {
    expect(tileProgress(0, 0, false)).toBe(0);
    expect(tileProgress(1, 0, false)).toBe(1);
    expect(tileProgress(0.5, 3, false)).toBeCloseTo(0.8 - 0.54);
  });
  it("staggers dots, starting later than tiles", () => {
    expect(dotProgress(0.3, 0, false)).toBe(0);
    expect(dotProgress(0.6, 0, false)).toBeCloseTo(0.6);
    expect(dotProgress(1, 5, false)).toBeCloseTo(0.8);
    expect(dotProgress(0.35, 4, false)).toBe(0);
  });
  it("are fully shown with reduced motion", () => {
    expect(tileProgress(0, 2, true)).toBe(1);
    expect(dotProgress(0, 2, true)).toBe(1);
  });
});

describe("pagerWidths", () => {
  it("moves the pill from the first dot to the second", () => {
    expect(pagerWidths(0)).toEqual([27, 5]);
    expect(pagerWidths(1)).toEqual([5, 27]);
  });
});
