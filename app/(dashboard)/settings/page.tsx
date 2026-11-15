"use client";

import { AppLookPicker } from "@/components/app-look-picker";
import { useFontSize } from "@/components/font-size-provider";
import { Minus, Plus, RotateCcw } from "lucide-react";

const PRESETS = [1, 1.1, 1.2, 1.3, 1.4, 1.5];

export default function SettingsPage() {
  const {
    scale,
    setScale,
    increase,
    decrease,
    reset,
    canIncrease,
    canDecrease,
  } = useFontSize();

  const percent = Math.round(scale * 100);

  return (
    <div className="pb-16 lowercase">
      {/* The green band, like the other pages; the search above it is the
          phone's top bar. */}
      <div
        data-settle-group="band"
        className="relative -mt-16 px-4 pt-[4.75rem] pb-14 text-white sm:mt-0
          sm:px-6 sm:pt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <div className="relative z-20 mx-auto max-w-xl">
          <p className="text-xs font-bold tracking-wider">settings</p>
          <p
            className="mt-3 text-[28px] leading-tight font-black tracking-tight"
          >
            make it yours
          </p>
          <p className="mt-1 text-sm font-semibold opacity-80">
            the look and text size of the whole app
          </p>
        </div>
      </div>

      <div
        data-settle
        className="relative z-10 mx-auto -mt-8 max-w-xl space-y-3 px-3 sm:px-6"
      >
        <div
          className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5
            dark:ring-white/10"
        >
          <div data-tour="app-look">
            <AppLookPicker />
          </div>
        </div>

        <section
          data-tour="text-size"
          className="space-y-4 rounded-2xl bg-card p-4 shadow-sm ring-1
            ring-black/5 dark:ring-white/10"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">text size</span>
            <span
              className="text-sm font-bold text-slate-500
                dark:text-muted-foreground"
            >
              {percent}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={decrease}
              disabled={!canDecrease}
              className="dark:border-border dark:bg-card dark:text-foreground
                flex size-11 items-center justify-center rounded-xl border-2
                border-slate-300 bg-white text-slate-600 transition
                active:scale-95 disabled:opacity-40"
              aria-label="Decrease text size"
            >
              <Minus className="size-5" />
            </button>

            <div className="relative flex-1">
              <input
                type="range"
                min={1}
                max={1.6}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none
                  rounded-full bg-slate-200 dark:bg-muted accent-slate-900
                  dark:accent-green-400"
                aria-label="Text size slider"
              />
            </div>

            <button
              type="button"
              onClick={increase}
              disabled={!canIncrease}
              className="dark:border-border dark:bg-card dark:text-foreground
                flex size-11 items-center justify-center rounded-xl border-2
                border-slate-300 bg-white text-slate-600 transition
                active:scale-95 disabled:opacity-40"
              aria-label="Increase text size"
            >
              <Plus className="size-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const active = Math.abs(scale - preset) < 0.001;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setScale(preset)}
                  className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold
                  transition active:scale-95 ${
                    active
                      ? `border-slate-900 bg-slate-900 text-white
                        dark:border-green-400 dark:bg-green-400
                        dark:text-slate-900`
                      : `border-slate-300 bg-white text-slate-600
                        dark:border-border dark:bg-card dark:text-foreground`
                  }`}
                >
                  {Math.round(preset * 100)}%
                </button>
              );
            })}
          </div>

          {scale !== 1 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs font-bold
                text-slate-500 underline decoration-2 underline-offset-2
                hover:text-slate-700 dark:text-muted-foreground
                dark:hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              reset to default
            </button>
          )}
        </section>

        <section
          className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5
            dark:ring-white/10"
        >
          <p
            className="text-xs font-bold text-slate-400
              dark:text-muted-foreground"
          >
            preview
          </p>
          <div className="mt-2 space-y-1">
            <p className="text-lg font-black">Sample heading</p>
            <p className="text-sm text-slate-600 dark:text-muted-foreground">
              This is how body text will look at {percent}% size.
            </p>
            <p className="text-xs text-slate-400">
              Smaller details and captions scale too.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
