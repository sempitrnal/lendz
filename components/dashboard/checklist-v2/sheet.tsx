"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * A bottom sheet in the style of the bottom nav's drawer: backdrop, grab
 * handle, rounded top, capped at 88dvh with its content scrolling.
 *
 * The screen owns a counter it bumps on every open and keys the children with
 * it, so each open starts from a clean state even while the previous sheet is
 * still animating out. Put the primary button in `SheetFooter` to keep it
 * visible while the content scrolls.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose(): void;
  /** Accessible name when the content has no heading of its own. */
  label?: string;
  children: ReactNode;
}) {
  // Portals need `document`; false on the server render.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  // While open: the page behind doesn't scroll, and focus moves into the
  // sheet; on close it goes back to whatever had it before.
  useEffect(() => {
    if (!open || !mounted) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-x-0 bottom-0 z-[9999] mx-auto flex
              max-h-[88dvh] max-w-md flex-col overflow-hidden rounded-t-3xl
              border-t border-border bg-card pb-[env(safe-area-inset-bottom)]
              outline-none shadow-[0_-8px_40px_rgba(0,0,0,0.4)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <span
                className="h-1.5 w-10 rounded-full bg-border"
                aria-hidden="true"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Sticks to the bottom of the sheet while its content scrolls. */
export function SheetFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 border-t border-border bg-card px-5 pt-3 pb-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
