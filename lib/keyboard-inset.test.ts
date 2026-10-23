import { describe, expect, it } from "vitest";
import { keyboardInset } from "@/lib/keyboard-inset";

describe("keyboardInset", () => {
  it("is null with no keyboard: the visible area is the whole window", () => {
    expect(
      keyboardInset({ innerHeight: 812, vvHeight: 812, vvOffsetTop: 0 }),
    ).toBeNull();
  });
  it("ignores small changes, like the browser's own bar showing or hiding", () => {
    expect(
      keyboardInset({ innerHeight: 812, vvHeight: 760, vvOffsetTop: 0 }),
    ).toBeNull();
  });
  it("lifts the sheet by the keyboard's height and caps it to what is left", () => {
    expect(
      keyboardInset({ innerHeight: 812, vvHeight: 500, vvOffsetTop: 0 }),
    ).toEqual({ bottom: 312, maxHeight: 484 });
  });
  it("counts the page being scrolled up above the visible area", () => {
    expect(
      keyboardInset({ innerHeight: 812, vvHeight: 500, vvOffsetTop: 100 }),
    ).toEqual({ bottom: 212, maxHeight: 484 });
  });
  it("never goes negative", () => {
    expect(
      keyboardInset({ innerHeight: 800, vvHeight: 300, vvOffsetTop: 600 }),
    ).toBeNull();
  });
});
