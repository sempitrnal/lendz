"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The word game's look, a per-device choice like the theme: classic white,
 * mint garden, warm paper, all green or sunset glass. Dark mode has one look.
 */
export type Look = "classic" | "mint" | "paper" | "green" | "sunset";

export const LOOKS: {
  id: Look;
  name: string;
  idea: string;
  /** Preview: the screen, a filled square, a wheel tile, a chained tile. */
  swatch: [string, string, string, string];
}[] = [
  {
    id: "mint",
    name: "mint garden",
    idea: "soft mint, cream board",
    swatch: [
      "linear-gradient(#ecfdf5,#e3f1e7)",
      "#059669",
      "#d1fae5",
      "#059669",
    ],
  },
  {
    id: "paper",
    name: "warm paper",
    idea: "sand and terracotta",
    swatch: [
      "linear-gradient(#f6efe3,#efe4d2)",
      "#c7663f",
      "#f1e6d2",
      "#c7663f",
    ],
  },
  {
    id: "green",
    name: "all green",
    idea: "green all over, gold letters",
    swatch: [
      "linear-gradient(#059669,#0f766e)",
      "#059669",
      "#ffffff",
      "#fcd34d",
    ],
  },
  {
    id: "sunset",
    name: "sunset glass",
    idea: "peach to lilac, frosted",
    swatch: [
      "linear-gradient(135deg,#ffe6d5,#f7dcef,#dcd8fb)",
      "#0d9488",
      "#ffffffcc",
      "linear-gradient(135deg,#fb923c,#ec4899)",
    ],
  },
  {
    id: "classic",
    name: "classic",
    idea: "the original, plain white",
    swatch: ["#f8faf9", "#059669", "#ecfdf5", "#059669"],
  },
];

const KEY = "word-game:look";
const CHANGED = "word-game-look-changed";
const DEFAULT: Look = "sunset";

function read(): Look {
  try {
    const v = localStorage.getItem(KEY);
    return LOOKS.some((l) => l.id === v) ? (v as Look) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLook(): [Look, (look: Look) => void] {
  const look = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const set = (next: Look) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not saved: it still changes for this visit through the event.
    }
    window.dispatchEvent(new Event(CHANGED));
  };
  return [look, set];
}

/** A sheet over the game to pick its look, with a small preview of each. */
export function LookPicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose(): void;
}) {
  const [look, setLook] = useLook();
  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="look-picker"
          className="absolute inset-0 z-50 flex items-end justify-center
            bg-black/30 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <m.div
            role="dialog"
            aria-label="Game look"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="m-3 w-full max-w-md rounded-3xl bg-card p-4
              text-card-foreground shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-black">game look</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  for light mode · dark mode stays dark
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-9 items-center justify-center rounded-full
                  bg-muted transition active:scale-90"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {LOOKS.map((option, i) => {
                const on = option.id === look;
                const [screen, fill, tile, tileOn] = option.swatch;
                return (
                  <m.button
                    key={option.id}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setLook(option.id)}
                    aria-pressed={on}
                    className={cn(
                      `relative overflow-hidden rounded-2xl text-left ring-2
                      transition-shadow`,
                      on ? "ring-emerald-500 shadow-md" : "ring-transparent",
                      option.id === "classic" && "col-span-2",
                    )}
                  >
                    <div
                      className="flex h-16 items-center justify-center gap-1.5"
                      style={{ background: screen }}
                    >
                      <span
                        className="flex size-7 items-center justify-center
                          rounded-md text-sm font-black text-white"
                        style={{ background: fill }}
                      >
                        a
                      </span>
                      <span
                        className="flex size-7 items-center justify-center
                          rounded-full text-sm font-black text-black/60"
                        style={{ background: tile }}
                      >
                        b
                      </span>
                      <span
                        className="flex size-7 items-center justify-center
                          rounded-full text-sm font-black text-white"
                        style={{ background: tileOn }}
                      >
                        c
                      </span>
                    </div>
                    <div className="bg-muted/50 px-2.5 py-1.5">
                      <p className="text-xs font-black">{option.name}</p>
                      <p
                        className="truncate text-[10px] font-semibold
                          text-muted-foreground"
                      >
                        {option.idea}
                      </p>
                    </div>
                    {on && (
                      <m.span
                        layoutId="look-check"
                        className="absolute top-1.5 right-1.5 flex size-5
                          items-center justify-center rounded-full
                          bg-emerald-500 text-white shadow"
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </m.span>
                    )}
                  </m.button>
                );
              })}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
