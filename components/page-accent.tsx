"use client";

import { useEffect } from "react";
import { accentCss, accentPalette, setPageAccent } from "@/lib/accent-palette";

/**
 * Gives the page below it a colour of its own: the top bar, the bands, the
 * bottom nav and the status strip follow it (see globals.css). It's a style
 * element rendered with the page, so the colour is there on the first paint
 * and goes when the page does; the page colours are registered properties, so
 * the change in either direction glides. A missing or malformed colour changes
 * nothing.
 */
export function PageAccent({ color }: { color: string | null | undefined }) {
  const accent = accentPalette(color);
  const css = accent ? accentCss(accent) : null;

  // The status strip's tag isn't CSS: tell it what the page's colour is.
  useEffect(() => {
    setPageAccent(accent);
    return () => setPageAccent(null);
    // `css` stands for `accent`: it only changes when the colour does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [css]);

  return css ? <style>{css}</style> : null;
}
