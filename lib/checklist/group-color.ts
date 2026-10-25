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
