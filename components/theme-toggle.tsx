"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "default" | "icon" | "icon-sm" | "icon-xs" | "icon-lg";
}

export default function ThemeToggle({
  className,
  size = "icon",
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn("opacity-0", className)}
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size={size}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className={cn(
        "dark:border-border dark:text-foreground dark:hover:bg-muted border-slate-300 text-stone-700 hover:bg-slate-100",
        className,
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
