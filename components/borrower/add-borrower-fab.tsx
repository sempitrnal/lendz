"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Sheet } from "@/components/dashboard/checklist-v2/sheet";

// Loaded with the page: fetching it on the first tap made that open stutter.
import BorrowerForm from "@/components/forms/borrower-form";

type AddBorrowerFabProps = {
  onSuccess?: () => void;
  /** "band": a round white button for the green band, instead of the FAB. */
  variant?: "fab" | "band";
};

export default function AddBorrowerFab({
  onSuccess,
  variant = "fab",
}: AddBorrowerFabProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  // Bumped on every open, so each one starts with an empty form.
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <>
      {variant === "band" && (
        <button
          type="button"
          aria-label="Add borrower"
          onClick={() => {
            setSeq((n) => n + 1);
            setOpen(true);
          }}
          className="relative flex size-9 shrink-0 items-center justify-center
            rounded-full bg-white text-emerald-600 shadow-sm
            transition-transform active:scale-90"
        >
          <Plus className="size-5" />
        </button>
      )}
      {variant === "fab" &&
        isMounted &&
        createPortal(
          <button
            type="button"
            aria-label="Add borrower"
            onClick={() => {
              setSeq((n) => n + 1);
              setOpen(true);
            }}
            className="group fixed right-5 bottom-24 z-50 flex h-14 items-center
              gap-0 overflow-hidden rounded-full bg-primary pr-0 pl-0
              text-primary-foreground shadow-lg shadow-primary/30 ring-1
              ring-primary/20 transition-all duration-300 ease-out hover:pr-5
              hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2
              focus-visible:ring-offset-background active:scale-95 md:right-8
              md:bottom-12"
          >
            <span className="flex size-14 shrink-0 items-center justify-center">
              <Plus
                className="size-6 transition-transform duration-300
                  group-hover:rotate-90"
              />
            </span>
            <span
              className="max-w-0 whitespace-nowrap text-sm font-semibold
                opacity-0 transition-all duration-300 ease-out
                group-hover:max-w-40 group-hover:opacity-100"
            >
              Add borrower
            </span>
          </button>,
          document.body,
        )}

      <Sheet open={open} onClose={closeModal} label="Add borrower">
        <BorrowerForm
          key={seq}
          onSuccess={() => {
            onSuccess?.();
            closeModal();
          }}
        />
      </Sheet>
    </>
  );
}
