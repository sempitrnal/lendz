"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "font-scale";
const MIN_SCALE = 1;
const MAX_SCALE = 1.6;
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

  useEffect(() => {
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
