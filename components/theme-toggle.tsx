"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "default" | "icon" | "icon-sm" | "icon-xs" | "icon-lg";
  /** A translucent disc for sitting on a green bar or band. */
  onColor?: boolean;
}

const SIZES = {
  default: "size-9",
  icon: "size-9",
  "icon-sm": "size-8",
  "icon-xs": "size-6",
  "icon-lg": "size-10",
} as const;

/**
 * A round button where the sun and the moon trade places: the one leaving
 * turns away and shrinks as the other turns in. On a green bar it's the same
 * translucent disc as the back button; elsewhere a quiet muted one.
 */
export default function ThemeToggle({
  className,
  size = "icon",
  onColor = false,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const icon = (shown: boolean, turn: string) =>
    cn(
      "absolute size-4 transition-all duration-300 ease-out",
      shown ? "scale-100 rotate-0 opacity-100" : `scale-50 opacity-0 ${turn}`,
    );

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      aria-hidden={!mounted}
      tabIndex={mounted ? 0 : -1}
      className={cn(
        `relative flex shrink-0 items-center justify-center overflow-hidden
        rounded-full transition-colors outline-none focus-visible:ring-2
        active:scale-95`,
        SIZES[size],
        onColor
          ? `bg-onpage/20 text-onpage hover:bg-onpage/30
            focus-visible:ring-onpage/70`
          : `bg-muted text-foreground/70 hover:bg-muted/70
            focus-visible:ring-ring`,
        !mounted && "opacity-0",
        className,
      )}
    >
      <Sun className={icon(isDark, "-rotate-90")} aria-hidden="true" />
      <Moon className={icon(!isDark, "rotate-90")} aria-hidden="true" />
    </button>
  );
}
