"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import type { ReleaseRowView } from "@/lib/checklist/release-items";
import { releaseNote } from "@/lib/checklist/release-list";

const AccountForm = dynamic(() => import("@/components/forms/account-form"), {
  loading: () => <FormSkeleton />,
});

/**
 * The create-account sheet for a release item: the real `AccountForm`,
 * prefilled from the typed note, creating without leaving the checklist.
 *
 * The form's own Create button (its last child) is made sticky from here
 * with CSS only, so the form itself is unchanged. There is no schedule
 * preview: it would need the form's live values, which it doesn't expose.
 *
 * Whether Create is running is read from outside the form too: a submit
 * starts it (`onSubmitStart`), and the form's own button turning enabled
 * again without `onSuccess` ends it (`onSubmitIdle`: an error or a failed
 * validation), so the screen can keep the item from being created twice.
 */
export function CreateAccountSheet({
  release,
  date,
  creating,
  onSubmitStart,
  onSubmitIdle,
  onCreated,
  onCheckOff,
}: {
  release: ReleaseRowView;
  date: string;
  /** Create is running for this item: no "Check off without account". */
  creating: boolean;
  onSubmitStart(): void;
  /** The form is idle again; ignored by the screen once the account is made. */
  onSubmitIdle(): void;
  /**
   * The form created the account (saved, or queued offline). It may come
   * after the sheet has closed; the screen acts on it once per item.
   */
  onCreated(): void;
  /** "Check off without account". */
  onCheckOff(): void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Stops watching the form's button (one watch at a time). */
  const stopWatchRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWatchRef.current?.(), []);

  /**
   * The form was submitted. react-hook-form disables its button while
   * `isSubmitting` (validation included), so: once it has been seen
   * disabled and is enabled again, or it never shows disabled within a
   * second, the run is over. A success has called `onCreated` before that.
   */
  const watchSubmit = () => {
    onSubmitStart();
    stopWatchRef.current?.();
    const started = Date.now();
    let seenBusy = false;
    const timer = window.setInterval(() => {
      const button = wrapRef.current?.querySelector<HTMLButtonElement>(
        "form > button:last-child",
      );
      if (!button) return;
      if (button.disabled) {
        seenBusy = true;
        return;
      }
      if (seenBusy || Date.now() - started > 1000) {
        stop();
        onSubmitIdle();
      }
    }, 100);
    const stop = () => {
      window.clearInterval(timer);
      stopWatchRef.current = null;
    };
    stopWatchRef.current = stop;
  };

  const parsed = release.parsed;
  if (!parsed) return null;
  const note = releaseNote(release.item.label);

  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-lg font-semibold">
        Create account{" "}
        <span className="lowercase">for {parsed.borrowerName}</span>
      </h2>
      {note && (
        <p className="text-sm text-muted-foreground">
          Filled in from your note: <span className="lowercase">“{note}”</span>
        </p>
      )}
      <div
        ref={wrapRef}
        onSubmitCapture={watchSubmit}
        className="mt-4 [&_form>button:last-child]:sticky
          [&_form>button:last-child]:bottom-3 [&_form>button:last-child]:z-10
          [&_form>button:last-child]:h-12 [&_form>button:last-child]:text-base
          [&_form>button:last-child]:shadow-[0_0_0_12px_var(--card)]"
      >
        <AccountForm
          key={`${release.item.id}-${date}`}
          borrowerId={parsed.borrowerId}
          initialValues={parsed.initialValues}
          redirectOnCreate={false}
          borrowerName={parsed.borrowerName}
          onSuccess={onCreated}
        />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        If an error shows after Create, check the borrower page before trying
        again.
      </p>
      <Button
        type="button"
        variant="ghost"
        className="mt-2 h-11 w-full"
        disabled={creating}
        onClick={onCheckOff}
      >
        Check off without account
      </Button>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Loading the form</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
        </div>
      ))}
    </div>
  );
}
