"use client";

export type HapticType = "light" | "medium" | "heavy" | "success" | "error" | "warning";

export function triggerHaptic(type: HapticType = "medium") {
  if (typeof window === "undefined") return;
  if ("vibrate" in navigator) {
    const patterns: Record<HapticType, number | number[]> = {
      light: 10,
      medium: 25,
      heavy: 50,
      success: [15, 30, 15],
      error: [40, 60, 40],
      warning: [30, 50, 30],
    };
    try {
      navigator.vibrate(patterns[type]);
    } catch {
      // ignore
    }
  }
}
