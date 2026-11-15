"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { Check, Palette } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppLook } from "@/components/use-app-look";
import { cn } from "@/lib/utils";
import { APP_LOOKS, type AppLook } from "@/lib/app-look";
import {
  LOOK_PROMPT_CHOICES,
  lookPromptPending,
  markLookPromptAsked,
} from "@/lib/app-look-prompt";

/** The pages that ask: where people land when they open the app. */
const PAGES = new Set(["/dashboard", "/daily-checklist", "/borrowers"]);

/** A short wait, so the page is up first (and before a tour would start). */
const DELAY_MS = 350;

/**
 * Asks once, after the release that brought the looks, which look to use:
 * royal plum gold or forest gold, side by side. Tapping one repaints the app
 * behind the dialog right away, so it can be tried before it's kept. Showing
 * it counts as asking: it never comes back.
 */
export function AppLookPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [look, setLook] = useAppLook();
  const eligible = PAGES.has(pathname);

  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => {
      // A walkthrough is on screen: don't pile a dialog on top of it.
      if (document.querySelector("[data-tour-overlay]")) return;
      if (!lookPromptPending()) return;
      markLookPromptAsked();
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  const choices = LOOK_PROMPT_CHOICES.map(
    (id) => APP_LOOKS.find((l) => l.id === id)!,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-3xl lowercase sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span
            className="mb-1 flex size-14 items-center justify-center
              rounded-full bg-primary/15 text-primary"
          >
            <Palette className="size-7" aria-hidden="true" />
          </span>
          <DialogTitle className="text-lg font-black tracking-tight">
            pick your look
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold">
            utangz has new colours. tap one to try it, you can change it any
            time in settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {choices.map((option, i) => {
            const on = look === option.id;
            const [band, page, card] = option.swatch;
            return (
              <m.button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => setLook(option.id as AppLook)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  `relative overflow-hidden rounded-2xl text-left ring-2
                  transition-shadow`,
                  on ? "ring-primary shadow-lg" : "ring-border",
                )}
              >
                <div className="h-28" style={{ background: page }}>
                  <div
                    className="flex h-12 items-start rounded-b-2xl px-3 pt-2.5
                      text-xs font-black text-white"
                    style={{ background: band }}
                  >
                    ₱555,267
                  </div>
                  <div
                    className="mx-2.5 -mt-4 flex h-12 items-center
                      justify-between rounded-xl px-2.5 shadow-sm"
                    style={{ background: card }}
                  >
                    <span className="h-1.5 w-10 rounded-full bg-black/10" />
                    {option.accent && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]
                          font-black text-white"
                        style={{ background: option.accent }}
                      >
                        pay
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-card px-3 py-2">
                  <p className="text-sm font-black">{option.name}</p>
                  <p
                    className="truncate text-[11px] font-semibold
                      text-muted-foreground"
                  >
                    {option.idea}
                  </p>
                </div>
                {on && (
                  <m.span
                    layoutId="look-prompt-check"
                    className="absolute top-2 right-2 flex size-6 items-center
                      justify-center rounded-full bg-primary
                      text-primary-foreground shadow"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </m.span>
                )}
              </m.button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-xl bg-primary text-sm font-bold
              text-primary-foreground transition active:scale-[0.98]"
          >
            use this look
          </button>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="text-center text-xs font-bold text-muted-foreground
              underline-offset-2 hover:underline"
          >
            see all looks in settings
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
