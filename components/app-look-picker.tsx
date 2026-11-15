"use client";

import { m } from "motion/react";
import { Check } from "lucide-react";

import { useAppLook } from "@/components/use-app-look";
import { cn } from "@/lib/utils";
import { APP_LOOKS } from "@/lib/app-look";

/**
 * The app look picker for Settings: a card per look with a tiny preview (a
 * band over a page with a card on it). Picking one repaints the app at once.
 */
export function AppLookPicker() {
  const [look, setLook] = useAppLook();
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-bold">app look</p>
        <p className="text-xs font-semibold text-muted-foreground">
          the colour of the bands, bars and pages · saved on this device
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {APP_LOOKS.map((option, i) => {
          const on = option.id === look;
          const [band, page, card] = option.swatch;
          return (
            <m.button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => setLook(option.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "relative overflow-hidden rounded-2xl text-left ring-2",
                on ? "ring-primary shadow-md" : "ring-border",
              )}
            >
              <div className="h-16" style={{ background: page }}>
                <div
                  className="h-7 rounded-b-xl"
                  style={{ background: band }}
                />
                <div
                  className="mx-2.5 -mt-2.5 flex h-7 items-center justify-end
                    rounded-lg px-2 shadow-sm"
                  style={{ background: card }}
                >
                  {option.accent && (
                    <span
                      className="size-3.5 rounded-full"
                      style={{ background: option.accent }}
                    />
                  )}
                </div>
              </div>
              <div className="bg-card px-2.5 py-1.5">
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
                  layoutId="app-look-check"
                  className="absolute top-1.5 right-1.5 flex size-5 items-center
                    justify-center rounded-full bg-primary
                    text-primary-foreground shadow"
                >
                  <Check className="size-3" strokeWidth={3} />
                </m.span>
              )}
            </m.button>
          );
        })}
      </div>
    </section>
  );
}
