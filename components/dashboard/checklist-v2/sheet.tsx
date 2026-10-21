"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

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
