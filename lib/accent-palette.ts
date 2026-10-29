/**
 * A page can take its colour from a category (the borrower page's band): the
 * top bar, the band, the folded header, the bottom nav and the status strip
 * all follow it, as a light but saturated version of that colour: the hue is
 * kept and the lightness raised, while the saturation stays up (mixing toward
 * white would wash it out to a grey tint). Category colours are free-form, so
 * what's drawn on it (text, chips, icons) is near-black, and a near-grey
 * colour stays near-grey. Dark mode gets a deep derived shade, with white ink.
 */
type RGB = [number, number, number];

const BLACK: RGB = [0, 0, 0];
/** The pastel's lightness (HSL) at the bar and band's top, and at its bottom. */
const LIGHT_TOP = 0.74;
const LIGHT_BOTTOM = 0.82;
/** Saturation is kept up to at least this, unless the colour is near-grey (little spread between its channels). */
const MIN_SATURATION = 0.9;
const GREY_CHROMA = 0.15;
/** What's drawn on the pastel. */
const DARK_INK = "#0f172a";

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const s = m[1];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
}

function rgbToHex(c: RGB): string {
  return (
    "#" +
    c
      .map((v) =>
        Math.round(Math.min(255, Math.max(0, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === R
      ? ((G - B) / d) % 6
      : max === G
        ? (B - R) / d + 2
        : (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contrast of white text on `c`. */
export function contrastOnWhite(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? 1.05 / (luminance(rgb) + 0.05) : 0;
}

export type Accent = {
  light: { top: string; bottom: string; on: string; ink: string };
  dark: { top: string; bottom: string; on: string; ink: string };
};

/** The palette for a category colour, or null when it isn't a `#rrggbb`. */
export function accentPalette(hex: string | null | undefined): Accent | null {
  const base = hex ? hexToRgb(hex) : null;
  if (!base) return null;
  const [h, sat, light] = rgbToHsl(base);
  const chroma = (Math.max(...base) - Math.min(...base)) / 255;
  const s2 = chroma < GREY_CHROMA ? sat : Math.max(sat, MIN_SATURATION);
  // A colour that is already lighter than the pastel keeps its own lightness.
  const lTop = Math.max(light, LIGHT_TOP);
  const top = hslToRgb(h, s2, lTop);
  const bottom = hslToRgb(h, s2, Math.max(lTop + 0.06, LIGHT_BOTTOM));
  const topHex = rgbToHex(top);
  const darkTop = mix(base, BLACK, 0.78);
  // Near-black on the pastel, unless the colour is so dark the pastel still
  // reads better with white.
  const inkDark = luminance(hexToRgb(DARK_INK)!);
  const onDark = (luminance(top) + 0.05) / (inkDark + 0.05);
  const onWhite = 1.05 / (luminance(top) + 0.05);
  return {
    light: {
      top: topHex,
      bottom: rgbToHex(bottom),
      // The bottom nav's selected pill is the ink, with the page colour as text.
      on: topHex,
      ink: onDark >= onWhite ? DARK_INK : "#ffffff",
    },
    dark: {
      top: rgbToHex(darkTop),
      bottom: rgbToHex(mix(darkTop, base, 0.3)),
      on: rgbToHex(darkTop),
      ink: "#ffffff",
    },
  };
}

/** The CSS that points the page colours (see globals.css) at the palette. */
export function accentCss(accent: Accent): string {
  const v = (a: Accent["light"]) =>
    `--page-1:${a.top};--page-2:${a.bottom};--page-on:${a.on};--page-fg:${a.ink};`;
  return `:root{${v(accent.light)}}.dark{${v(accent.dark)}}`;
}
/** What the current page's accent is, for the status bar's `theme-color`. */
let current: Accent | null = null;
export const ACCENT_EVENT = "page-accent-changed";

export function getPageAccent(): Accent | null {
  return current;
}

export function setPageAccent(accent: Accent | null) {
  current = accent;
  window.dispatchEvent(new Event(ACCENT_EVENT));
}
