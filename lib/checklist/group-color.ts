import type { CSSProperties } from "react";

/** r, g, b (0-255) of "#rgb", "#rrggbb" or "white"; null when unreadable. */
function rgb(color: string): [number, number, number] | null {
  const value = color.trim().toLowerCase();
  if (value === "white") return [255, 255, 255];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1];
  if (!hex) return null;
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** White or nearly (a category tinted white shows no border of its own). */
export function isLightColor(color: string | null | undefined): boolean {
  const parts = color ? rgb(color) : null;
  if (!parts) return false;
  const [r, g, b] = parts;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 235;
}

/** WCAG relative luminance of r, g, b (0-255). */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const DARK_TEXT = "#1f2937";

/**
 * Text that reads on a category colour: white or near-black, whichever
 * contrasts more with it.
 */
export function textOn(color: string | null | undefined): string | undefined {
  const parts = color ? rgb(color) : null;
  if (!parts) return undefined;
  const bg = luminance(parts);
  const dark = luminance(rgb(DARK_TEXT)!);
  const onWhite = 1.05 / (bg + 0.05);
  const onDark = (bg + 0.05) / (dark + 0.05);
  return onWhite >= onDark ? "#ffffff" : DARK_TEXT;
}

/** How much of the category colour a group header shows over the card. */
export const HEADER_TINT = 0.55;

const LIGHT_CARD: [number, number, number] = [255, 255, 255];
/** The dark theme's card (oklch 0.205 0 0). */
const DARK_CARD: [number, number, number] = [23, 23, 23];

/**
 * A group header's colours: its category colour at `HEADER_TINT` over the
 * card, with text picked for that blend in each theme.
 */
export function headerStyle(
  color: string | null | undefined,
): CSSProperties | undefined {
  const parts = color ? rgb(color) : null;
  if (!color || !parts) return undefined;
  const mix = (base: [number, number, number], amount: number) =>
    `#${parts
      .map((c, i) =>
        Math.round(c * amount + base[i] * (1 - amount))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  const BLACK: [number, number, number] = [0, 0, 0];
  const WHITE: [number, number, number] = [255, 255, 255];
  // The name: the category's own colour, deepened on a light header and
  // lifted on a dark one, so it reads in its own hue.
  const nameOn = (fg: string | undefined) =>
    fg === "#ffffff" ? mix(WHITE, 0.15) : mix(BLACK, 0.5);
  const fgLight = textOn(mix(LIGHT_CARD, HEADER_TINT));
  const fgDark = textOn(mix(DARK_CARD, HEADER_TINT));
  return {
    "--hdr": color,
    "--hdr-fg": fgLight,
    "--hdr-fg-dark": fgDark,
    "--hdr-name": nameOn(fgLight),
    "--hdr-name-dark": nameOn(fgDark),
  } as CSSProperties;
}

/**
 * The inline style a category group sets on its section: `--grp` (the tint)
 * and, for a white category, `--grp-border` so the name pills get a gray
 * border instead of an invisible one.
 */
export function groupColorStyle(
  color: string | null | undefined,
): CSSProperties | undefined {
  if (!color) return undefined;
  return {
    "--grp": color,
    ...(isLightColor(color) ? { "--grp-border": "#9ca3af" } : {}),
  } as CSSProperties;
}
