"use client";

import { announceNavigation } from "@/lib/nav-splash";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Puzzle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { manilaToday } from "@/lib/word-game/date";
import {
  readPrompted,
  shouldPrompt,
  writePrompted,
} from "@/lib/word-game/prompt";
import { readAll } from "@/lib/word-game/storage";

/** The pages that ask: the dashboard and the checklist. */
const PAGES = new Set(["/dashboard", "/daily-checklist"]);

/** How long after arriving the prompt waits, so it never races the page. */
const DELAY_MS = 900;

/**
 * Once a day, on the dashboard or the checklist, asks whether to play the
 * daily word, unless today's puzzle has already been played. Showing it counts
 * as asking: dismissing it means it does not come back until tomorrow, on
 * either page.
 */
export function WordGamePrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const eligible = PAGES.has(pathname);

  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => {
      // A walkthrough is on screen: don't pile a dialog on top of it.
      if (document.querySelector("[data-tour-overlay]")) return;
      const today = manilaToday();
      if (!shouldPrompt(readAll(), today, askedToday())) return;
      remember(today);
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-3xl lowercase sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <span
            className="mb-1 flex size-14 items-center justify-center
              rounded-full bg-emerald-100 text-emerald-700
              dark:bg-emerald-500/20 dark:text-emerald-300"
          >
            <Puzzle className="size-7" aria-hidden="true" />
          </span>
          <DialogTitle className="text-lg font-black tracking-tight">
            today&apos;s daily word
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold">
            you haven&apos;t played yet. want a quick puzzle break?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 flex-1 rounded-xl bg-muted text-sm font-bold
              text-muted-foreground active:bg-muted/70"
          >
            not now
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              (announceNavigation("/word-game"), router.push("/word-game"));
            }}
            className="h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-bold
              text-white active:bg-emerald-700"
          >
            play now
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The day the prompt was last shown. Kept in memory too, so a browser that
 * won't store anything still only asks once per visit.
 */
let askedInMemory: string | null = null;
function askedToday(): string | null {
  return readPrompted() ?? askedInMemory;
}
function remember(day: string) {
  askedInMemory = day;
  writePrompted(day);
}
