"use client";

import { useEffect } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Plus, StickyNote, Wallet, type LucideIcon } from "lucide-react";
import { SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  Icon: LucideIcon;
  /** Tint for the icon chip. */
  chip: string;
  onSelect: () => void;
};

/**
 * The borrower page's add button: one round button that fans out "new loan"
 * and "new note" above it, over a light scrim. It sits just above the bottom
 * nav on phones.
 */
export function BorrowerFab({
  open,
  onOpenChange,
  onAddLoan,
  onAddNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddLoan: () => void;
  onAddNote: () => void;
}) {
  const reduceMotion = useReducedMotion();

  const actions: Action[] = [
    {
      label: "new loan",
      Icon: Wallet,
      chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      onSelect: onAddLoan,
    },
    {
      label: "new note",
      Icon: StickyNote,
      chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      onSelect: onAddNote,
    },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <m.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-background/70"
          />
        )}
      </AnimatePresence>

      <div
        className="fixed right-4 bottom-[76px] z-50 flex flex-col items-end
          gap-3 md:right-8 md:bottom-12"
      >
        <AnimatePresence>
          {open &&
            actions.map(({ label, Icon, chip, onSelect }, i) => (
              <m.button
                key={label}
                type="button"
                role="menuitem"
                initial={
                  reduceMotion ? false : { opacity: 0, y: 14, scale: 0.9 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: 8,
                        scale: 0.95,
                        transition: { duration: 0.1 },
                      }
                }
                transition={{
                  ...SPRING_SWAP,
                  delay: reduceMotion ? 0 : (actions.length - 1 - i) * 0.04,
                }}
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                onClick={() => {
                  onOpenChange(false);
                  onSelect();
                }}
                className="flex items-center gap-2.5 rounded-full border
                  border-border bg-card py-1.5 pr-4 pl-1.5 text-sm font-semibold
                  text-card-foreground"
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full",
                    chip,
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {label}
              </m.button>
            ))}
        </AnimatePresence>

        <m.button
          type="button"
          data-tour="borrower-fab"
          aria-label={open ? "Close actions" : "Open actions"}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          transition={SPRING_PRESS}
          className="flex size-14 items-center justify-center rounded-2xl
            bg-primary text-primary-foreground"
        >
          <m.span
            animate={{ rotate: open ? 135 : 0 }}
            transition={reduceMotion ? { duration: 0 } : SPRING_SWAP}
            className="flex"
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden="true" />
          </m.span>
        </m.button>
      </div>
    </>
  );
}
