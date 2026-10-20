"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FONT_SCALE_STORAGE_KEY,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
} from "@/lib/font-scale";

const STORAGE_KEY = FONT_SCALE_STORAGE_KEY;
const MIN_SCALE = MIN_FONT_SCALE;
const MAX_SCALE = MAX_FONT_SCALE;
const STEP = 0.1;

type FontSizeContextValue = {
  scale: number;
  setScale: (scale: number) => void;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
};

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

function clampScale(scale: number) {
  return Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.round(scale * 100) / 100),
  );
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScaleState(clampScale(parsed));
      }
    }
  }, []);

  // The first run would write the default 1 over the size the head script
  // already applied, for a frame, before the saved size is read below.
  const appliedOnce = useRef(false);
  useEffect(() => {
    if (!appliedOnce.current) {
      appliedOnce.current = true;
      return;
    }
    document.documentElement.style.setProperty("--font-scale", String(scale));
  }, [scale]);

  const setScale = useCallback((value: number) => {
    setScaleState(clampScale(value));
  }, []);

  const increase = useCallback(() => {
    setScaleState((prev) => clampScale(prev + STEP));
  }, []);

  const decrease = useCallback(() => {
    setScaleState((prev) => clampScale(prev - STEP));
  }, []);

  const reset = useCallback(() => {
    setScaleState(1);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (scale === 1) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(scale));
    }
  }, [scale]);

  const value: FontSizeContextValue = {
    scale,
    setScale,
    increase,
    decrease,
    reset,
    canIncrease: scale < MAX_SCALE,
    canDecrease: scale > MIN_SCALE,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const ctx = useContext(FontSizeContext);
  if (!ctx) {
    throw new Error("useFontSize must be used within FontSizeProvider");
  }
  return ctx;
}
