"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { keyboardInset } from "@/lib/keyboard-inset";

/** Follows the on-screen keyboard while `active`: null when there is none. */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState<ReturnType<typeof keyboardInset>>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => {
      const next = keyboardInset({
        innerHeight: window.innerHeight,
        vvHeight: vv.height,
        vvOffsetTop: vv.offsetTop,
      });
      // Same numbers: keep the old object, so nothing re-renders.
      setInset((prev) =>
        prev?.bottom === next?.bottom && prev?.maxHeight === next?.maxHeight
          ? prev
          : next,
      );
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setInset(null);
    };
  }, [active]);
  return inset;
}

/**
 * A bottom sheet on the shadcn drawer (vaul): backdrop, grab handle, drag
 * down to dismiss, rounded top, capped at 88dvh with its content scrolling.
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
  // The screen drops a sheet's children the moment it closes; keep the last
  // ones on screen while the drawer slides out.
  const [shown, setShown] = useState(children);
  if (open && shown !== children) setShown(children);
  // With the keyboard up the sheet lifts above it and shrinks to what is left.
  const keyboard = useKeyboardInset(open);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      // The keyboard must not move the sheet: the amount inputs stay put.
      repositionInputs={false}
    >
      <DrawerContent
        aria-describedby={undefined}
        // A tour pointing into the sheet must not close it by taking focus or
        // taps.
        onInteractOutside={(e) => {
          if ((e.target as Element | null)?.closest?.("[data-tour-overlay]")) {
            e.preventDefault();
          }
        }}
        style={
          keyboard
            ? { bottom: keyboard.bottom, maxHeight: keyboard.maxHeight }
            : undefined
        }
        className="z-[9999] mx-auto max-h-[88dvh] max-w-md overflow-hidden
          rounded-t-3xl border-t border-border bg-card
          pb-[env(safe-area-inset-bottom)] outline-none
          shadow-[0_-8px_40px_rgba(0,0,0,0.4)]"
      >
        <DrawerTitle className="sr-only">{label ?? "Sheet"}</DrawerTitle>
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <span
            className="h-1.5 w-10 rounded-full bg-border"
            aria-hidden="true"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {open ? children : shown}
        </div>
      </DrawerContent>
    </Drawer>
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
