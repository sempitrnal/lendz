import { describe, expect, it } from "vitest";
import { accentCss, accentPalette, contrastOnWhite } from "./accent-palette";

function hsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/** Contrast of the ink on the colour, for either ink. */
function inkContrast(top: string, ink: string) {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (v: number) =>
      v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const [a, b] = [lum(top), lum(ink)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

describe("accentPalette", () => {
  it("gives nothing for a missing or malformed colour", () => {
    expect(accentPalette(null)).toBeNull();
    expect(accentPalette("")).toBeNull();
    expect(accentPalette("violet")).toBeNull();
    expect(accentPalette("#abc")).toBeNull();
  });

  it("makes a light colour that keeps its hue and stays saturated", () => {
    const a = accentPalette("#7c3aed")!;
    const [h0] = hsl(accentPalette("#7c3aed")!.light.top);
    const [hBase] = hsl("#7c3aed");
    expect(Math.abs(h0 - hBase)).toBeLessThan(2);
    const [, sat, light] = hsl(a.light.top);
    expect(sat).toBeGreaterThanOrEqual(0.88);
    expect(light).toBeGreaterThan(0.72);
    // Lighter still at the bottom.
    expect(hsl(a.light.bottom)[2]).toBeGreaterThan(light);
  });

  it("leaves a near-grey colour near-grey", () => {
    expect(hsl(accentPalette("#cbd5e1")!.light.top)[1]).toBeLessThan(0.4);
    expect(hsl(accentPalette("#808080")!.light.top)[1]).toBe(0);
  });

  it("keeps the ink readable on any colour's pastel", () => {
    for (const hex of [
      "#a78bfa",
      "#fbbf24",
      "#cbd5e1",
      "#34d399",
      "#e6e219",
      "#92400e",
      "#000000",
      "#ffffff",
    ]) {
      const a = accentPalette(hex)!;
      expect(inkContrast(a.light.top, a.light.ink)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("derives a deep dark-mode shade with white ink", () => {
    const a = accentPalette("#fbbf24")!;
    expect(a.dark.ink).toBe("#ffffff");
    expect(contrastOnWhite(a.dark.top)).toBeGreaterThan(7);
  });
});

describe("accentCss", () => {
  it("points the page colours at both modes", () => {
    const css = accentCss(accentPalette("#92400e")!);
    expect(css).toContain(":root{--page-1:#");
    expect(css).toContain("--page-fg:#0f172a;");
    expect(css).toContain(".dark{--page-1:");
  });
});
