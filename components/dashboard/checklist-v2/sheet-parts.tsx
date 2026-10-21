"use client";

import { useLayoutEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatAmountInput,
  indexAfterSignificant,
  significantBefore,
} from "@/lib/checklist/amount-input";

/**
 * The sheet title: the borrower's name (lowercase), which opens their page.
 * Without a borrower it is plain text.
 */
export function BorrowerTitle({
  name,
  onOpen,
}: {
  name: string;
  onOpen?: () => void;
}) {
  if (!onOpen) {
    return <h2 className="truncate text-lg font-semibold lowercase">{name}</h2>;
  }
  return (
    <h2 className="min-w-0 text-lg font-semibold lowercase">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name}, open borrower page`}
        className="inline-flex max-w-full items-center gap-1 text-left
          active:opacity-70"
      >
        <span className="truncate">{name}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </h2>
  );
}

/** A peso amount input: decimal keypad, "₱" prefix, right-aligned. */
export function AmountInput({
  value,
  onChange,
  label,
  invalid,
  disabled,
  className,
  autoFocus,
}: {
  value: string;
  onChange(value: string): void;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  /** Digits and dots before the caret, restored after the commas change. */
  const caret = useRef<number | null>(null);
  const shown = formatAmountInput(value);

  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || caret.current === null) return;
    const at = indexAfterSignificant(input.value, caret.current);
    caret.current = null;
    if (document.activeElement === input) input.setSelectionRange(at, at);
  });

  return (
    <label
      className={cn(
        `flex h-10 items-center gap-1 rounded-lg border bg-background px-2.5
        transition-colors focus-within:ring-3`,
        invalid
          ? "border-destructive focus-within:ring-destructive/20"
          : "border-input focus-within:border-ring focus-within:ring-ring/50",
        disabled && "opacity-60",
        className,
      )}
    >
      <span className="text-sm font-semibold text-muted-foreground">₱</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        ref={ref}
        autoFocus={autoFocus}
        value={shown}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const input = e.target;
          caret.current = significantBefore(
            input.value,
            input.selectionStart ?? input.value.length,
          );
          onChange(formatAmountInput(input.value));
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-base
          font-semibold tabular-nums outline-none"
      />
    </label>
  );
}

/** Loading placeholder for a sheet's installment list. */
export function SheetListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-2.5 rounded-2xl bg-muted/40 p-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-1.5 animate-pulse rounded-full bg-muted" />
          <div className="h-14 animate-pulse rounded-xl bg-muted/70" />
        </div>
      ))}
    </div>
  );
}
